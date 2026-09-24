import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQueryClient } from "@tanstack/react-query";
import type { Rezervacia } from "../../api/rezervacieFields";
import type { Vozidlo } from "../../api/vozidlaFields";
import { fetchRezervacieVRozsahu } from "../../api/rezervacieData";
import { CalendarModal } from "../../components/CalendarModal";
import { useAuth } from "../../auth/AuthContext";
import {
  useMojeRezervacie,
  usePredlzitRezervaciu,
  useRezervacie,
  useVozidla,
  useZrusitRezervaciu,
} from "../../hooks/useVozidla";
import type { RootStackParamList } from "../../navigation/RootNavigator";
import { colors, font, spacing } from "../../theme";
import {
  dayAfterDateOnly,
  daysAheadDateOnly,
  formatDateShort,
  todayDateOnly,
} from "../../utils/dates";
import {
  dostupnostVozidla,
  formatRezervaciaObdobie,
  najdiKolizie,
} from "../../utils/rezervacie";
import type { VozidlaStackParamList } from "./VozidlaNavigator";

type Nav = NativeStackNavigationProp<RootStackParamList & VozidlaStackParamList>;

export function VozidlaHomeScreen() {
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const { getValidAccessToken } = useAuth();
  const today = todayDateOnly();
  const horizon = daysAheadDateOnly(13);

  const vozidlaQuery = useVozidla();
  const rezervacieQuery = useRezervacie(today, horizon);
  const mojeQuery = useMojeRezervacie();
  const zrusit = useZrusitRezervaciu();
  const predlzit = usePredlzitRezervaciu();

  const [extendTarget, setExtendTarget] = useState<Rezervacia | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const vozidlaBySpz = useMemo(() => {
    const map = new Map<string, Vozidlo>();
    for (const v of vozidlaQuery.data ?? []) {
      map.set(v.spz.trim().toLowerCase(), v);
    }
    return map;
  }, [vozidlaQuery.data]);

  const nazovVozidla = (spz: string) =>
    vozidlaBySpz.get(spz.trim().toLowerCase())?.nazov ?? spz;

  const onRefresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["vozidla"] }),
      queryClient.invalidateQueries({ queryKey: ["rezervacie"] }),
      queryClient.invalidateQueries({ queryKey: ["mojeRezervacie"] }),
    ]);
  };

  const refreshing =
    vozidlaQuery.isRefetching ||
    rezervacieQuery.isRefetching ||
    mojeQuery.isRefetching;

  const canManage = (r: Rezervacia) =>
    r.stav === "Rezervovane" || r.stav === "Prevzate";

  const onZrusit = (r: Rezervacia) => {
    Alert.alert(
      "Zrušiť rezerváciu?",
      `${nazovVozidla(r.vozidloSpz)} · ${formatRezervaciaObdobie(r.od, r.do)}`,
      [
        { text: "Nie", style: "cancel" },
        {
          text: "Zrušiť rezerváciu",
          style: "destructive",
          onPress: () => {
            setActionError(null);
            void zrusit.mutateAsync(r.id).catch((err) => {
              setActionError(err instanceof Error ? err.message : String(err));
            });
          },
        },
      ],
    );
  };

  const onPredlzitSelect = async (noveDo: string) => {
    const r = extendTarget;
    setExtendTarget(null);
    if (!r) return;
    if (noveDo <= r.do) {
      setActionError("Nový dátum Do musí byť neskôr ako pôvodné Do.");
      return;
    }

    setActionError(null);
    try {
      const token = await getValidAccessToken();
      const existujuce = await fetchRezervacieVRozsahu(token, r.od, noveDo);
      const kolizie = najdiKolizie(
        {
          vozidloSpz: r.vozidloSpz,
          od: r.od,
          do: noveDo,
          excludeId: r.id,
        },
        existujuce,
      );
      if (kolizie.length > 0) {
        const k = kolizie[0]!;
        setActionError(
          `Kolízia s rezerváciou ${formatRezervaciaObdobie(k.od, k.do)} (${k.title || k.zamestnanecEmail}).`,
        );
        return;
      }
      await predlzit.mutateAsync({
        id: r.id,
        noveDo,
        nazovVozidla: nazovVozidla(r.vozidloSpz),
        od: r.od,
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  };

  const loadError =
    (vozidlaQuery.isError && vozidlaQuery.error) ||
    (rezervacieQuery.isError && rezervacieQuery.error) ||
    (mojeQuery.isError && mojeQuery.error);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.topBar}>
          <Pressable
            style={styles.backBtn}
            onPress={() => navigation.navigate("Hub")}
          >
            <Text style={styles.backBtnText}>← Hub</Text>
          </Pressable>
          <Text style={styles.topBarTitle}>Vozidlá</Text>
          <View style={styles.backBtnPlaceholder} />
        </View>

        {loadError ? (
          <Text style={styles.error} selectable>
            {loadError instanceof Error ? loadError.message : String(loadError)}
          </Text>
        ) : null}
        {actionError ? (
          <Text style={styles.error} selectable>
            {actionError}
          </Text>
        ) : null}

        <Text style={styles.sectionTitle}>Moje rezervácie</Text>
        {mojeQuery.isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (mojeQuery.data ?? []).length === 0 ? (
          <Text style={styles.muted}>Žiadna aktívna rezervácia.</Text>
        ) : (
          (mojeQuery.data ?? []).map((r) => (
            <View key={r.id} style={styles.card}>
              <Text style={styles.cardTitle}>{nazovVozidla(r.vozidloSpz)}</Text>
              <Text style={styles.cardSub}>
                {formatRezervaciaObdobie(r.od, r.do)}
                {r.stav === "Prevzate" ? " · Prevzaté" : ""}
              </Text>
              {r.zakazkaId ? (
                <Text style={styles.cardMeta}>Zákazka: {r.zakazkaId}</Text>
              ) : null}
              {r.cielCesty ? (
                <Text style={styles.cardMeta}>Cieľ: {r.cielCesty}</Text>
              ) : null}

              {canManage(r) ? (
                <View style={styles.actions}>
                  <Pressable
                    style={styles.actionBtn}
                    onPress={() => setExtendTarget(r)}
                    disabled={predlzit.isPending}
                  >
                    <Text style={styles.actionBtnText}>Predĺžiť</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionBtn, styles.actionDanger]}
                    onPress={() => onZrusit(r)}
                    disabled={zrusit.isPending}
                  >
                    <Text style={[styles.actionBtnText, styles.actionDangerText]}>
                      Zrušiť
                    </Text>
                  </Pressable>
                  {r.stav === "Prevzate" ? (
                    <Pressable style={[styles.actionBtn, styles.actionDisabled]} disabled>
                      <Text style={styles.actionDisabledText}>
                        Odovzdať · Pripravujeme
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
          ))
        )}

        <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>
          Vozidlá
        </Text>
        <Text style={styles.sectionHint}>Dostupnosť na 14 dní</Text>

        {vozidlaQuery.isError ? (
          <View style={styles.errorBox}>
            <Text style={styles.error} selectable>
              {vozidlaQuery.error instanceof Error
                ? vozidlaQuery.error.message
                : String(vozidlaQuery.error)}
            </Text>
            <Pressable
              style={styles.retryBtn}
              onPress={() => void vozidlaQuery.refetch()}
            >
              <Text style={styles.retryBtnText}>Skúsiť znovu</Text>
            </Pressable>
          </View>
        ) : vozidlaQuery.isLoading || rezervacieQuery.isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (vozidlaQuery.data ?? []).length === 0 ? (
          <Text style={styles.muted}>Žiadne aktívne vozidlá.</Text>
        ) : (
          (vozidlaQuery.data ?? []).map((v) => {
            const info = dostupnostVozidla(
              v,
              rezervacieQuery.data ?? [],
              today,
              14,
            );
            return (
              <View key={v.id} style={styles.card}>
                <Text style={styles.cardTitle}>
                  {v.nazov}
                  {v.spz ? ` · ${v.spz}` : ""}
                </Text>
                <Text style={styles.availText}>{info.text}</Text>
                {info.useky.map((u) => (
                  <Text key={u.rezervaciaId} style={styles.usekLine}>
                    {formatDateShort(u.od)}–{formatDateShort(u.do)} · {u.meno}
                    {u.stav === "Prevzate" ? " (prevzaté)" : ""}
                  </Text>
                ))}
              </View>
            );
          })
        )}

        <Pressable
          style={styles.primaryBtn}
          onPress={() => navigation.navigate("NovaRezervacia")}
        >
          <Text style={styles.primaryBtnText}>Nová rezervácia</Text>
        </Pressable>
      </ScrollView>

      <CalendarModal
        visible={extendTarget != null}
        selected={
          extendTarget ? dayAfterDateOnly(extendTarget.do) : today
        }
        minDate={
          extendTarget ? dayAfterDateOnly(extendTarget.do) : today
        }
        maxDate={daysAheadDateOnly(60)}
        onSelect={(d) => void onPredlzitSelect(d)}
        onClose={() => setExtendTarget(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl * 2,
    gap: spacing.sm,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  backBtn: { minWidth: 72, paddingVertical: spacing.xs },
  backBtnPlaceholder: { minWidth: 72 },
  backBtnText: {
    fontSize: font.md,
    fontWeight: "700",
    color: colors.primary,
  },
  topBarTitle: {
    fontSize: font.lg,
    fontWeight: "800",
    color: colors.text,
  },
  sectionTitle: {
    fontSize: font.lg,
    fontWeight: "800",
    color: colors.text,
    marginTop: spacing.sm,
  },
  sectionHint: { fontSize: font.sm, color: colors.muted, marginTop: -4 },
  muted: { fontSize: font.sm, color: colors.muted, lineHeight: 18 },
  error: { fontSize: font.sm, color: colors.danger, lineHeight: 18 },
  errorBox: { gap: spacing.sm },
  retryBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  retryBtnText: {
    fontSize: font.sm,
    fontWeight: "700",
    color: colors.primary,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  cardTitle: {
    fontSize: font.md,
    fontWeight: "800",
    color: colors.text,
  },
  cardSub: { fontSize: font.md, fontWeight: "600", color: colors.primary },
  cardMeta: { fontSize: font.sm, color: colors.muted },
  availText: {
    fontSize: font.md,
    fontWeight: "700",
    color: colors.primaryMuted,
  },
  usekLine: { fontSize: font.sm, color: colors.muted },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  actionBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  actionBtnText: {
    fontSize: font.sm,
    fontWeight: "700",
    color: colors.primary,
  },
  actionDanger: {
    borderColor: colors.danger,
    backgroundColor: "#FCEBEA",
  },
  actionDangerText: { color: colors.danger },
  actionDisabled: {
    borderColor: colors.border,
    backgroundColor: colors.bg,
    opacity: 0.85,
  },
  actionDisabledText: {
    fontSize: font.sm,
    fontWeight: "600",
    color: colors.muted,
  },
  primaryBtn: {
    marginTop: spacing.lg,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: colors.primaryText,
    fontSize: font.lg,
    fontWeight: "800",
  },
});
