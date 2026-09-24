import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useKeyboardHeight } from "../../hooks/useKeyboardHeight";
import { useAuth } from "../../auth/AuthContext";
import { RangeCalendarModal } from "../../components/RangeCalendarModal";
import { WorkItemPickerModal } from "../../components/WorkItemPickerModal";
import {
  useRezervacie,
  useUpravitRezervaciu,
  useVozidla,
} from "../../hooks/useVozidla";
import { useWorkCatalog } from "../../hooks/useWorkItems";
import { colors, font, spacing } from "../../theme";
import type { WorkItem } from "../../types/workItems";
import { formatEntryZakazkaLabel } from "../../api/workItemsPicker";
import { fetchRezervacieVRozsahu } from "../../api/rezervacieData";
import {
  daysAheadDateOnly,
  formatDateSk,
  inclusiveDayCount,
  todayDateOnly,
} from "../../utils/dates";
import {
  formatRezervaciaObdobie,
  menoZRezervacie,
  najdiKolizie,
  obsadeneDniVozidla,
  REZERVACIA_MAX_DAYS,
  REZERVACIA_MAX_DAYS_AHEAD,
} from "../../utils/rezervacie";
import type { VozidlaStackParamList } from "./VozidlaNavigator";

/** Zmena nezačatej rezervácie: termín, zákazka, cieľ cesty. Vozidlo sa nemení. */
export function UpravitRezervaciuScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const cielFocusedRef = useRef(false);
  const keyboardHeight = useKeyboardHeight();

  useEffect(() => {
    if (keyboardHeight <= 0 || !cielFocusedRef.current) return;
    const t = setTimeout(
      () => scrollRef.current?.scrollToEnd({ animated: true }),
      50,
    );
    return () => clearTimeout(t);
  }, [keyboardHeight]);

  const navigation =
    useNavigation<NativeStackNavigationProp<VozidlaStackParamList>>();
  const route =
    useRoute<RouteProp<VozidlaStackParamList, "UpravitRezervaciu">>();
  const rezervacia = route.params.rezervacia;

  const { getValidAccessToken } = useAuth();
  const vozidlaQuery = useVozidla();
  const workCatalogQuery = useWorkCatalog();
  const upravit = useUpravitRezervaciu();

  const today = todayDateOnly();
  const maxRezervacieDate = daysAheadDateOnly(REZERVACIA_MAX_DAYS_AHEAD);
  const obsadenostQuery = useRezervacie(today, maxRezervacieDate);

  const [od, setOd] = useState(rezervacia.od);
  const [doDate, setDoDate] = useState(rezervacia.do);
  const [selectedWork, setSelectedWork] = useState<WorkItem | null>(null);
  const [cielCesty, setCielCesty] = useState(rezervacia.cielCesty);
  const [formError, setFormError] = useState<string | null>(null);
  const [terminOpen, setTerminOpen] = useState(false);
  const [workOpen, setWorkOpen] = useState(false);

  const vozidlo = useMemo(() => {
    const spz = rezervacia.vozidloSpz.trim().toLowerCase();
    return (vozidlaQuery.data ?? []).find(
      (v) => v.spz.trim().toLowerCase() === spz,
    );
  }, [vozidlaQuery.data, rezervacia.vozidloSpz]);
  const nazovVozidla = vozidlo?.nazov ?? rezervacia.vozidloSpz;

  const prefilledWork = useMemo(() => {
    const id = rezervacia.zakazkaId.trim().toLowerCase();
    if (!id) return null;
    const items = workCatalogQuery.data?.pickerItems ?? [];
    const matches = items.filter(
      (i) => i.zakazkaId.trim().toLowerCase() === id,
    );
    return matches.find((i) => i.kind === "zakazka") ?? matches[0] ?? null;
  }, [workCatalogQuery.data, rezervacia.zakazkaId]);

  const work = selectedWork ?? prefilledWork;
  const zakazkaId = work?.zakazkaId ?? rezervacia.zakazkaId;

  const busyDates = useMemo(
    () =>
      obsadeneDniVozidla(
        obsadenostQuery.data ?? [],
        rezervacia.vozidloSpz,
        today,
        maxRezervacieDate,
        rezervacia.id,
      ),
    [obsadenostQuery.data, rezervacia, today, maxRezervacieDate],
  );

  const onSubmit = async () => {
    if (od < today) {
      setFormError("Dátum Od nemôže byť v minulosti.");
      return;
    }
    if (doDate < od) {
      setFormError("Dátum Do musí byť rovný alebo neskôr ako Od.");
      return;
    }
    if (inclusiveDayCount(od, doDate) > REZERVACIA_MAX_DAYS) {
      setFormError(
        `Maximálna dĺžka rezervácie je ${REZERVACIA_MAX_DAYS} dní.`,
      );
      return;
    }
    if (!zakazkaId.trim()) {
      setFormError("Vyberte zákazku alebo objednávku.");
      return;
    }
    if (!cielCesty.trim()) {
      setFormError("Cieľ cesty je povinný.");
      return;
    }

    setFormError(null);
    try {
      const token = await getValidAccessToken();
      const existujuce = await fetchRezervacieVRozsahu(token, od, doDate);
      const kolizie = najdiKolizie(
        {
          vozidloSpz: rezervacia.vozidloSpz,
          od,
          do: doDate,
          excludeId: rezervacia.id,
        },
        existujuce,
      );
      if (kolizie.length > 0) {
        const k = kolizie[0]!;
        setFormError(
          `Kolízia s rezerváciou ${menoZRezervacie(k)}, ${formatRezervaciaObdobie(k.od, k.do)}.`,
        );
        return;
      }

      await upravit.mutateAsync({
        id: rezervacia.id,
        nazovVozidla,
        od,
        do: doDate,
        zakazkaId,
        cielCesty: cielCesty.trim(),
      });
      navigation.goBack();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    }
  };

  const zakazkaFallbackLabel = formatEntryZakazkaLabel(
    rezervacia.zakazkaId,
    workCatalogQuery.data?.zakazkyById ?? {},
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + spacing.xl * 2 + keyboardHeight },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topBar}>
            <Pressable
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backBtnText}>← Späť</Text>
            </Pressable>
            <Text style={styles.topBarTitle}>Zmeniť rezerváciu</Text>
            <View style={styles.backBtnPlaceholder} />
          </View>

          <Text style={styles.label}>Vozidlo</Text>
          <View style={[styles.selectBtn, styles.selectLocked]}>
            <Text style={styles.selectValue}>
              {nazovVozidla}
              {rezervacia.vozidloSpz ? ` · ${rezervacia.vozidloSpz}` : ""}
            </Text>
          </View>

          <Text style={styles.label}>1. Termín (od – do) *</Text>
          <Pressable
            style={styles.selectBtn}
            onPress={() => setTerminOpen(true)}
          >
            <Text style={styles.selectValue}>
              {od === doDate
                ? `${formatDateSk(od)} (1 deň)`
                : `${formatDateSk(od)} – ${formatDateSk(doDate)} (${inclusiveDayCount(od, doDate)} dní)`}
            </Text>
          </Pressable>

          <Text style={styles.label}>2. Zákazka *</Text>
          <Pressable
            style={styles.selectBtn}
            onPress={() => setWorkOpen(true)}
          >
            {work ? (
              <View style={styles.selectedInline}>
                <Text style={styles.selectedLabel}>{work.label}</Text>
                {work.subtitle ? (
                  <Text style={styles.selectedSub}>{work.subtitle}</Text>
                ) : null}
              </View>
            ) : rezervacia.zakazkaId ? (
              <Text style={styles.selectedLabel}>{zakazkaFallbackLabel}</Text>
            ) : (
              <Text style={styles.selectPlaceholder}>
                Vyberte zákazku alebo objednávku…
              </Text>
            )}
          </Pressable>
          {workCatalogQuery.isError ? (
            <Text style={styles.error}>
              {workCatalogQuery.error instanceof Error
                ? workCatalogQuery.error.message
                : "Nepodarilo sa načítať zákazky."}
            </Text>
          ) : null}

          <Text style={styles.label}>3. Cieľ cesty *</Text>
          <TextInput
            style={styles.input}
            value={cielCesty}
            onChangeText={setCielCesty}
            placeholder="napr. JUTA a.s., Dvůr Králové"
            placeholderTextColor={colors.muted}
            onFocus={() => {
              cielFocusedRef.current = true;
            }}
            onBlur={() => {
              cielFocusedRef.current = false;
            }}
          />

          {formError ? (
            <Text style={styles.error} selectable>
              {formError}
            </Text>
          ) : null}

          <Pressable
            style={[
              styles.submitBtn,
              upravit.isPending && styles.submitDisabled,
            ]}
            disabled={upravit.isPending}
            onPress={() => {
              Keyboard.dismiss();
              void onSubmit();
            }}
          >
            {upravit.isPending ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text style={styles.submitText}>Uložiť zmeny</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <RangeCalendarModal
        visible={terminOpen}
        od={od}
        doDate={doDate}
        minDate={today}
        maxDate={maxRezervacieDate}
        maxDays={REZERVACIA_MAX_DAYS}
        busyDates={busyDates}
        onConfirm={(nextOd, nextDo) => {
          setOd(nextOd);
          setDoDate(nextDo);
          setFormError(null);
        }}
        onClose={() => setTerminOpen(false)}
      />

      <WorkItemPickerModal
        visible={workOpen}
        selectedKey={work?.key ?? null}
        onSelect={setSelectedWork}
        onClose={() => setWorkOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
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
  label: {
    fontSize: font.md,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.sm,
  },
  selectBtn: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: "center",
  },
  selectLocked: { backgroundColor: colors.bg },
  selectValue: { fontSize: font.lg, fontWeight: "600", color: colors.text },
  selectPlaceholder: { fontSize: font.lg, color: colors.muted },
  selectedInline: { gap: 2 },
  selectedLabel: {
    fontSize: font.md,
    fontWeight: "700",
    color: colors.text,
    lineHeight: 20,
  },
  selectedSub: { fontSize: font.sm, color: colors.muted },
  input: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    fontSize: font.lg,
    color: colors.text,
  },
  error: { fontSize: font.sm, color: colors.danger, lineHeight: 18 },
  submitBtn: {
    marginTop: spacing.md,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  submitDisabled: { opacity: 0.7 },
  submitText: {
    color: colors.primaryText,
    fontSize: font.lg,
    fontWeight: "800",
  },
});
