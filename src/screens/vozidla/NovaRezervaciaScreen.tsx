import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../../auth/AuthContext";
import { BottomSheetModal } from "../../components/BottomSheetModal";
import { FormScrollView } from "../../components/FormScrollView";
import { RangeCalendarModal } from "../../components/RangeCalendarModal";
import { WorkItemPickerModal } from "../../components/WorkItemPickerModal";
import { cs } from "../../i18n/cs";
import {
  useCreateRezervacia,
  useRezervacie,
  useVozidla,
} from "../../hooks/useVozidla";
import { useWorkCatalog } from "../../hooks/useWorkItems";
import { colors, font, spacing } from "../../theme";
import type { WorkItem } from "../../types/workItems";
import type { Vozidlo } from "../../api/vozidlaFields";
import {
  daysAheadDateOnly,
  inclusiveDayCount,
  todayDateOnly,
} from "../../utils/dates";
import {
  dostupnostVozidla,
  formatRezervaciaObdobie,
  formatTerminRezervace,
  menoZRezervacie,
  najdiKolizie,
  obsadeneDniVozidla,
  REZERVACIA_MAX_DAYS,
  REZERVACIA_MAX_DAYS_AHEAD,
} from "../../utils/rezervacie";
import { fetchRezervacieVRozsahu } from "../../api/rezervacieData";
import type { VozidlaStackParamList } from "./VozidlaNavigator";

const MAX_DAYS = REZERVACIA_MAX_DAYS;
const T = cs.vozidla;
const E = cs.vozidla.chyby;

export function NovaRezervaciaScreen() {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<VozidlaStackParamList>>();
  const { getValidAccessToken } = useAuth();
  const vozidlaQuery = useVozidla();
  const workCatalogQuery = useWorkCatalog();
  const createMutation = useCreateRezervacia();

  const today = todayDateOnly();
  const [selectedVozidlo, setSelectedVozidlo] = useState<Vozidlo | null>(null);
  const [od, setOd] = useState(today);
  const [doDate, setDoDate] = useState(today);
  const [selectedWork, setSelectedWork] = useState<WorkItem | null>(null);
  const [cielCesty, setCielCesty] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [vozidloOpen, setVozidloOpen] = useState(false);
  const [terminOpen, setTerminOpen] = useState(false);
  const [workOpen, setWorkOpen] = useState(false);

  const horizon = daysAheadDateOnly(13);
  const rezervacieQuery = useRezervacie(today, horizon);

  const vozidla = vozidlaQuery.data ?? [];

  const dostupnostMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of vozidla) {
      map.set(
        v.id,
        dostupnostVozidla(v, rezervacieQuery.data ?? [], today, 14).text,
      );
    }
    return map;
  }, [vozidla, rezervacieQuery.data, today]);

  // Obsadené dni vybraného vozidla (na 90 dní) — v kalendári červené.
  const maxRezervacieDate = daysAheadDateOnly(REZERVACIA_MAX_DAYS_AHEAD);
  const obsadenostQuery = useRezervacie(today, maxRezervacieDate);
  const busyDates = useMemo(
    () =>
      obsadeneDniVozidla(
        obsadenostQuery.data ?? [],
        selectedVozidlo?.spz ?? "",
        today,
        maxRezervacieDate,
      ),
    [selectedVozidlo, obsadenostQuery.data, today, maxRezervacieDate],
  );

  const onSubmit = async () => {
    setWarning(null);
    setSuccessMsg(null);

    if (!selectedVozidlo) {
      setFormError(E.vyberteVozidlo);
      return;
    }
    if (od < today) {
      setFormError(E.odVMinulosti);
      return;
    }
    if (doDate < od) {
      setFormError(E.doPredOdem);
      return;
    }
    if (inclusiveDayCount(od, doDate) > MAX_DAYS) {
      setFormError(E.maxDelka(MAX_DAYS));
      return;
    }
    if (!selectedWork) {
      setFormError(E.vyberteZakazku);
      return;
    }
    if (!cielCesty.trim()) {
      setFormError(E.cilPovinny);
      return;
    }

    setFormError(null);

    try {
      const token = await getValidAccessToken();
      const existujuce = await fetchRezervacieVRozsahu(token, od, doDate);
      const kolizie = najdiKolizie(
        {
          vozidloSpz: selectedVozidlo.spz,
          od,
          do: doDate,
        },
        existujuce,
      );
      if (kolizie.length > 0) {
        const k = kolizie[0]!;
        setFormError(
          E.kolize(menoZRezervacie(k), formatRezervaciaObdobie(k.od, k.do)),
        );
        return;
      }

      const createdId = await createMutation.mutateAsync({
        nazovVozidla: selectedVozidlo.nazov,
        vozidloSpz: selectedVozidlo.spz,
        od,
        do: doDate,
        zakazkaId: selectedWork.zakazkaId,
        cielCesty: cielCesty.trim(),
      });

      const after = await fetchRezervacieVRozsahu(token, od, doDate);
      const late = najdiKolizie(
        {
          vozidloSpz: selectedVozidlo.spz,
          od,
          do: doDate,
          excludeId: createdId || undefined,
        },
        after,
      );
      if (late.length > 0) {
        const k = late[0]!;
        setWarning(
          E.kolizePozde(menoZRezervacie(k), formatRezervaciaObdobie(k.od, k.do)),
        );
      } else {
        setSuccessMsg(T.rezervaceUlozena);
      }

      setCielCesty("");
      setSelectedWork(null);
      void rezervacieQuery.refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <FormScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + spacing.xl * 2 },
          ]}
        >
          <View style={styles.topBar}>
            <Pressable
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backBtnText}>{cs.spolecne.zpet}</Text>
            </Pressable>
            <Text style={styles.topBarTitle}>{T.novaRezervace}</Text>
            <View style={styles.backBtnPlaceholder} />
          </View>

          <Text style={styles.label}>{T.vozidloPovinno}</Text>
          <Pressable
            style={styles.selectBtn}
            onPress={() => setVozidloOpen(true)}
          >
            <Text
              style={
                selectedVozidlo ? styles.selectValue : styles.selectPlaceholder
              }
            >
              {selectedVozidlo
                ? `${selectedVozidlo.nazov} · ${selectedVozidlo.spz}`
                : T.vyberteVozidlo}
            </Text>
          </Pressable>

          <Text style={styles.label}>{T.termin}</Text>
          <Pressable
            style={styles.selectBtn}
            onPress={() => setTerminOpen(true)}
          >
            <Text style={styles.selectValue}>
              {formatTerminRezervace(od, doDate)}
            </Text>
          </Pressable>

          <Text style={styles.label}>{T.zakazkaPovinna}</Text>
          <Pressable
            style={styles.selectBtn}
            onPress={() => setWorkOpen(true)}
          >
            {selectedWork ? (
              <View style={styles.selectedInline}>
                <Text style={styles.selectedLabel}>{selectedWork.label}</Text>
                {selectedWork.subtitle ? (
                  <Text style={styles.selectedSub}>
                    {selectedWork.subtitle}
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text style={styles.selectPlaceholder}>
                {cs.odvod.vyberteZakazku}
              </Text>
            )}
          </Pressable>
          {workCatalogQuery.isError ? (
            <Text style={styles.error}>
              {workCatalogQuery.error instanceof Error
                ? workCatalogQuery.error.message
                : T.nacteniZakazek}
            </Text>
          ) : null}

          <Text style={styles.label}>{T.cilCesty}</Text>
          <TextInput
            style={styles.input}
            value={cielCesty}
            onChangeText={setCielCesty}
            placeholder={T.cilPlaceholder}
            placeholderTextColor={colors.muted}
          />

          {formError ? (
            <Text style={styles.error} selectable>
              {formError}
            </Text>
          ) : null}
          {warning ? (
            <Text style={styles.warning} selectable>
              {warning}
            </Text>
          ) : null}
          {successMsg ? <Text style={styles.success}>{successMsg}</Text> : null}

          <Pressable
            style={[
              styles.submitBtn,
              createMutation.isPending && styles.submitDisabled,
            ]}
            disabled={createMutation.isPending}
            onPress={() => {
              Keyboard.dismiss();
              void onSubmit();
            }}
          >
            {createMutation.isPending ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text style={styles.submitText}>{T.ulozitRezervaci}</Text>
            )}
          </Pressable>
        </FormScrollView>

      <BottomSheetModal
        visible={vozidloOpen}
        title={T.vozidlo}
        onClose={() => setVozidloOpen(false)}
        tall
      >
        {vozidlaQuery.isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <FlatList
            data={vozidla}
            keyExtractor={(item) => item.id}
            style={styles.modalList}
            ListEmptyComponent={
              <Text style={styles.muted}>{T.zadnaAktivniVozidla}</Text>
            }
            renderItem={({ item }) => (
              <Pressable
                style={[
                  styles.modalOption,
                  selectedVozidlo?.id === item.id && styles.modalOptionActive,
                ]}
                onPress={() => {
                  setSelectedVozidlo(item);
                  setVozidloOpen(false);
                }}
              >
                <Text style={styles.modalOptionText}>
                  {item.nazov} · {item.spz}
                </Text>
                <Text style={styles.modalOptionSub}>
                  {dostupnostMap.get(item.id) ?? "—"}
                </Text>
              </Pressable>
            )}
          />
        )}
      </BottomSheetModal>

      <RangeCalendarModal
        visible={terminOpen}
        od={od}
        doDate={doDate}
        minDate={today}
        maxDate={maxRezervacieDate}
        maxDays={MAX_DAYS}
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
        selectedKey={selectedWork?.key ?? null}
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
  warning: {
    fontSize: font.sm,
    color: "#9A6700",
    lineHeight: 18,
    fontWeight: "600",
  },
  success: {
    fontSize: font.md,
    color: colors.success,
    fontWeight: "700",
  },
  muted: { fontSize: font.sm, color: colors.muted },
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
  modalList: { flex: 1 },
  modalOption: {
    marginTop: spacing.xs,
    padding: spacing.md,
    borderRadius: 10,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  modalOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  modalOptionText: {
    fontSize: font.md,
    fontWeight: "700",
    color: colors.text,
  },
  modalOptionSub: { fontSize: font.sm, color: colors.muted },
});
