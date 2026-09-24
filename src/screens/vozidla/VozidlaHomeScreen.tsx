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
import { RangeCalendarModal } from "../../components/RangeCalendarModal";
import { useAuth } from "../../auth/AuthContext";
import {
  useMojeRezervacie,
  useRezervacie,
  useVozidla,
  useZmenitKoniecRezervacie,
  useZrusitRezervaciu,
} from "../../hooks/useVozidla";
import type { RootStackParamList } from "../../navigation/RootNavigator";
import { colors, font, spacing } from "../../theme";
import {
  addDaysDateOnly,
  daysAheadDateOnly,
  formatDateShort,
  inclusiveDayCount,
  todayDateOnly,
} from "../../utils/dates";
import {
  dostupnostVozidla,
  formatRezervaciaObdobie,
  menoZRezervacie,
  najdiKolizie,
  obsadeneDniVozidla,
  REZERVACIA_MAX_DAYS,
  REZERVACIA_MAX_DAYS_AHEAD,
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
  const zmenitKoniec = useZmenitKoniecRezervacie();

  const maxRezervacieDate = daysAheadDateOnly(REZERVACIA_MAX_DAYS_AHEAD);
  const obsadenostQuery = useRezervacie(today, maxRezervacieDate);

  const [endTarget, setEndTarget] = useState<Rezervacia | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const endBusyDates = useMemo(
    () =>
      endTarget
        ? obsadeneDniVozidla(
            obsadenostQuery.data ?? [],
            endTarget.vozidloSpz,
            today,
            maxRezervacieDate,
            endTarget.id,
          )
        : new Set<string>(),
    [endTarget, obsadenostQuery.data, today, maxRezervacieDate],
  );

  const endMinDate =
    endTarget && endTarget.od > today ? endTarget.od : today;
  const endMaxDate = (() => {
    if (!endTarget) return maxRezervacieDate;
    const byLength = addDaysDateOnly(endTarget.od, REZERVACIA_MAX_DAYS - 1);
    return byLength < maxRezervacieDate ? byLength : maxRezervacieDate;
  })();

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

  /** Zapíše nový koniec; Od sa nemení. */
  const ulozitKoniec = async (r: Rezervacia, noveDo: string) => {
    if (noveDo === r.do) return;
    const minDo = r.od > today ? r.od : today;
    if (noveDo < minDo) {
      setActionError("Koniec rezervácie nemôže byť pred začiatkom ani v minulosti.");
      return;
    }
    if (inclusiveDayCount(r.od, noveDo) > REZERVACIA_MAX_DAYS) {
      setActionError(
        `Maximálna dĺžka rezervácie je ${REZERVACIA_MAX_DAYS} dní.`,
      );
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
          `Kolízia s rezerváciou ${menoZRezervacie(k)}, ${formatRezervaciaObdobie(k.od, k.do)}.`,
        );
        return;
      }
      await zmenitKoniec.mutateAsync({
        id: r.id,
        noveDo,
        nazovVozidla: nazovVozidla(r.vozidloSpz),
        od: r.od,
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  };

  const onOdovzdatSkor = (r: Rezervacia) => {
    Alert.alert(
      "Ukončiť rezerváciu dnes?",
      "Vozidlo sa uvoľní pre ostatných od zajtra.",
      [
        { text: "Nie", style: "cancel" },
        {
          text: "Ukončiť dnes",
          onPress: () => void ulozitKoniec(r, today),
        },
      ],
    );
  };

  const actionPending = zrusit.isPending || zmenitKoniec.isPending;

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
                  {r.od > today ? (
                    <>
                      <Pressable
                        style={styles.actionBtn}
                        onPress={() =>
                          navigation.navigate("UpravitRezervaciu", {
                            rezervacia: r,
                          })
                        }
                        disabled={actionPending}
                      >
                        <Text style={styles.actionBtnText}>Zmeniť</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.actionBtn, styles.actionDanger]}
                        onPress={() => onZrusit(r)}
                        disabled={actionPending}
                      >
                        <Text
                          style={[styles.actionBtnText, styles.actionDangerText]}
                        >
                          Zrušiť
                        </Text>
                      </Pressable>
                    </>
                  ) : r.do >= today ? (
                    <>
                      <Pressable
                        style={styles.actionBtn}
                        onPress={() => setEndTarget(r)}
                        disabled={actionPending}
                      >
                        <Text style={styles.actionBtnText}>Zmeniť koniec</Text>
                      </Pressable>
                      {r.do !== today ? (
                        <Pressable
                          style={styles.actionBtn}
                          onPress={() => onOdovzdatSkor(r)}
                          disabled={actionPending}
                        >
                          <Text style={styles.actionBtnText}>Odovzdať skôr</Text>
                        </Pressable>
                      ) : null}
                    </>
                  ) : null}
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

      <RangeCalendarModal
        visible={endTarget != null}
        od={endTarget?.od ?? today}
        doDate={endTarget?.do ?? today}
        minDate={endMinDate}
        maxDate={endMaxDate}
        maxDays={REZERVACIA_MAX_DAYS}
        busyDates={endBusyDates}
        fixedStart
        title="Zmeniť koniec rezervácie"
        onConfirm={(_od, noveDo) => {
          const r = endTarget;
          if (r) void ulozitKoniec(r, noveDo);
        }}
        onClose={() => setEndTarget(null)}
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
