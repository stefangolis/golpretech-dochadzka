import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
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
import { useAuth } from "../auth/AuthContext";
import { BottomSheetModal } from "../components/BottomSheetModal";
import { CalendarModal } from "../components/CalendarModal";
import { MyEntriesSection } from "../components/MyEntriesSection";
import { UkonPickerModal } from "../components/UkonPickerModal";
import { WorkItemPickerModal } from "../components/WorkItemPickerModal";
import { MINUTE_PRESETS } from "../constants/minutes";
import { useCreateTimeEntry, useMyEntries } from "../hooks/useMyEntries";
import { useUkony } from "../hooks/useUkony";
import { useWorkCatalog } from "../hooks/useWorkItems";
import { useKeyboardHeight } from "../hooks/useKeyboardHeight";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, font, spacing } from "../theme";
import type { UkonItem } from "../types/ukon";
import {
  daysAgoDateOnly,
  formatDateShort,
  formatDateSk,
  todayDateOnly,
} from "../utils/dates";
import { parseMinutes, validateTimeEntry } from "../utils/validation";

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const scrollRef = useRef<ScrollView>(null);
  const noteFocusedRef = useRef(false);
  const keyboardHeight = useKeyboardHeight();
  const { user } = useAuth();
  const workCatalogQuery = useWorkCatalog();
  const ukonyQuery = useUkony();
  const myEntriesQuery = useMyEntries();
  const createEntry = useCreateTimeEntry();

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [minutesRaw, setMinutesRaw] = useState("");
  const [dateOnly, setDateOnly] = useState(todayDateOnly());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [workOpen, setWorkOpen] = useState(false);
  const [minutesOpen, setMinutesOpen] = useState(false);
  const [ukonOpen, setUkonOpen] = useState(false);
  const [selectedUkon, setSelectedUkon] = useState<UkonItem | null>(null);
  const [rework, setRework] = useState(false);
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const today = todayDateOnly();
  const yesterday = daysAgoDateOnly(1);
  const dayBefore = daysAgoDateOnly(2);

  const pickerItems = workCatalogQuery.data?.pickerItems ?? [];

  const selectedItem = useMemo(() => {
    if (!selectedKey) return null;
    return pickerItems.find((i) => i.key === selectedKey) ?? null;
  }, [selectedKey, pickerItems]);

  const validUkonNames = useMemo(
    () => ukonyQuery.data?.map((u) => u.nazov) ?? [],
    [ukonyQuery.data],
  );

  // Po zobrazení klávesnice (a odsadení obsahu) posuň na poznámku.
  useEffect(() => {
    if (keyboardHeight <= 0 || !noteFocusedRef.current) return;
    const t = setTimeout(
      () => scrollRef.current?.scrollToEnd({ animated: true }),
      50,
    );
    return () => clearTimeout(t);
  }, [keyboardHeight]);

  // Pri návrate do appky v nový deň predvyber dnešný dátum.
  const lastDayRef = useRef(todayDateOnly());
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      const t = todayDateOnly();
      if (t !== lastDayRef.current) {
        lastDayRef.current = t;
        setDateOnly(t);
      }
    });
    return () => sub.remove();
  }, []);

  const onRefresh = async () => {
    await Promise.all([
      workCatalogQuery.refetch(),
      ukonyQuery.refetch(),
      myEntriesQuery.refetch(),
    ]);
  };

  const onSubmit = async () => {
    setSuccessMsg(null);

    const selection = selectedItem
      ? selectedItem.kind === "zakazka"
        ? {
            kind: "zakazka" as const,
            zakazkaId: selectedItem.zakazkaId,
            cisloObjednavky: "" as const,
          }
        : {
            kind: "objednavka" as const,
            zakazkaId: selectedItem.zakazkaId,
            cisloObjednavky: selectedItem.cisloObjednavky,
          }
      : null;

    const error = validateTimeEntry({
      selection,
      minutesRaw,
      dateOnly,
      ukon: selectedUkon?.nazov ?? null,
      validUkonNames,
      rework,
      poznamka: note,
    });
    if (error || !selection || !selectedUkon) {
      setFormError(error ?? "Skontrolujte formulár.");
      return;
    }

    const minuty = parseMinutes(minutesRaw);
    if (minuty == null) {
      setFormError("Minúty musia byť celé číslo od 1 do 720.");
      return;
    }

    setFormError(null);
    try {
      await createEntry.mutateAsync({
        datum: dateOnly,
        zakazkaId: selection.zakazkaId,
        cisloObjednavky: selection.cisloObjednavky,
        minuty,
        ukon: selectedUkon.nazov,
        rework,
        poznamka: note.trim(),
      });
      setSuccessMsg(`Uložené: ${minuty} min · ${selectedUkon.nazov}`);
      setMinutesRaw("");
      setNote("");
      setRework(false);
      setSelectedUkon(null);
      setSelectedKey(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    }
  };

  const refreshing =
    workCatalogQuery.isRefetching ||
    ukonyQuery.isRefetching ||
    myEntriesQuery.isRefetching;

  const bottomPad = insets.bottom + spacing.xl * 3 + spacing.md;

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
            styles.scrollContent,
            { paddingBottom: bottomPad + keyboardHeight },
          ]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.header}>
            <View style={styles.topBar}>
              <Pressable
                style={styles.backBtn}
                onPress={() => navigation.navigate("Hub")}
              >
                <Text style={styles.backBtnText}>← Hub</Text>
              </Pressable>
              <Text style={styles.topBarTitle}>Odvod hodín</Text>
              <View style={styles.backBtnPlaceholder} />
            </View>

            {user ? (
              <Text style={styles.userHint} numberOfLines={1}>
                {user.displayName}
              </Text>
            ) : null}

            <MyEntriesSection
              entries={myEntriesQuery.data}
              isLoading={myEntriesQuery.isLoading}
              isError={myEntriesQuery.isError}
              error={myEntriesQuery.error}
            />

            <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>
              Nový zápis
            </Text>

            <Text style={styles.label}>1. Dátum *</Text>
            <View style={styles.dateRow}>
              <DateChip
                title="Dnes"
                active={dateOnly === today}
                onPress={() => setDateOnly(today)}
              />
              <DateChip
                title={formatDateShort(yesterday)}
                active={dateOnly === yesterday}
                onPress={() => setDateOnly(yesterday)}
              />
              <DateChip
                title={formatDateShort(dayBefore)}
                active={dateOnly === dayBefore}
                onPress={() => setDateOnly(dayBefore)}
              />
              <DateChip
                title="Manuálne"
                active={
                  dateOnly !== today &&
                  dateOnly !== yesterday &&
                  dateOnly !== dayBefore
                }
                onPress={() => setCalendarOpen(true)}
                outline
              />
            </View>
            <Text style={styles.dateValue}>{formatDateSk(dateOnly)}</Text>

            <Text style={styles.label}>2. Zákazka / objednávka *</Text>
            <Pressable
              style={styles.selectBtn}
              onPress={() => setWorkOpen(true)}
            >
              {selectedItem ? (
                <View style={styles.selectedInline}>
                  <Text style={styles.selectedLabel}>{selectedItem.label}</Text>
                  {selectedItem.subtitle ? (
                    <Text style={styles.selectedSub}>
                      {selectedItem.subtitle}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <Text style={styles.selectPlaceholder}>
                  Vyberte zákazku alebo objednávku…
                </Text>
              )}
            </Pressable>
            {workCatalogQuery.isError ? (
              <View style={styles.errorBox}>
                <Text style={styles.error} selectable>
                  {workCatalogQuery.error instanceof Error
                    ? workCatalogQuery.error.message
                    : String(workCatalogQuery.error)}
                </Text>
                <Pressable
                  style={styles.retryBtn}
                  onPress={() => void workCatalogQuery.refetch()}
                >
                  <Text style={styles.retryBtnText}>Skúsiť znovu</Text>
                </Pressable>
              </View>
            ) : null}

            <Text style={styles.label}>3. Minúty (1–720) *</Text>
            <View style={styles.minutesRow}>
              <Pressable
                style={styles.minutesDropdown}
                onPress={() => setMinutesOpen(true)}
              >
                <Text
                  style={
                    minutesRaw ? styles.selectValue : styles.selectPlaceholder
                  }
                >
                  {minutesRaw || "Vyberte…"}
                </Text>
              </Pressable>
              <TextInput
                style={styles.minutesManual}
                value={minutesRaw}
                onChangeText={setMinutesRaw}
                keyboardType="number-pad"
                placeholder="ručne"
                placeholderTextColor={colors.muted}
              />
            </View>

            <Text style={styles.label}>4. Úkon *</Text>
            <Pressable
              style={styles.selectBtn}
              onPress={() => setUkonOpen(true)}
            >
              <Text
                style={
                  selectedUkon ? styles.selectValue : styles.selectPlaceholder
                }
              >
                {selectedUkon?.nazov ?? "Vyberte úkon…"}
              </Text>
            </Pressable>
            {ukonyQuery.isError ? (
              <View style={styles.errorBox}>
                <Text style={styles.error} selectable>
                  {ukonyQuery.error instanceof Error
                    ? ukonyQuery.error.message
                    : String(ukonyQuery.error)}
                </Text>
                <Pressable
                  style={styles.retryBtn}
                  onPress={() => void ukonyQuery.refetch()}
                >
                  <Text style={styles.retryBtnText}>Skúsiť znovu</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.reworkRow}>
              <Text style={styles.labelInline}>Rework</Text>
              <Switch
                value={rework}
                onValueChange={setRework}
                trackColor={{ false: colors.border, true: colors.primaryMuted }}
                thumbColor={rework ? colors.primary : "#f4f4f4"}
              />
            </View>

            <Text style={styles.label}>Poznámka{rework ? " *" : ""}</Text>
            <TextInput
              style={[styles.input, styles.noteInput]}
              value={note}
              onChangeText={setNote}
              placeholder={rework ? "Povinná pri Rework" : "Voliteľná"}
              placeholderTextColor={colors.muted}
              multiline
              onFocus={() => {
                noteFocusedRef.current = true;
              }}
              onBlur={() => {
                noteFocusedRef.current = false;
              }}
            />

            {formError ? (
              <Text style={styles.error} selectable>
                {formError}
              </Text>
            ) : null}
            {successMsg ? (
              <Text style={styles.success}>{successMsg}</Text>
            ) : null}

            <Pressable
              style={[
                styles.submitBtn,
                { marginBottom: insets.bottom + spacing.sm },
                createEntry.isPending && styles.submitDisabled,
              ]}
              disabled={createEntry.isPending}
              onPress={() => {
                Keyboard.dismiss();
                void onSubmit();
              }}
            >
              {createEntry.isPending ? (
                <ActivityIndicator color={colors.primaryText} />
              ) : (
                <Text style={styles.submitText}>Uložiť zápis</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <CalendarModal
        visible={calendarOpen}
        selected={dateOnly}
        onSelect={setDateOnly}
        onClose={() => setCalendarOpen(false)}
      />

      <WorkItemPickerModal
        visible={workOpen}
        selectedKey={selectedKey}
        onSelect={(item) => {
          setSelectedKey(item.key);
          setSuccessMsg(null);
          setFormError(null);
        }}
        onClose={() => setWorkOpen(false)}
      />

      <BottomSheetModal
        visible={minutesOpen}
        title="Minúty"
        onClose={() => setMinutesOpen(false)}
      >
        {MINUTE_PRESETS.map((m) => (
          <Pressable
            key={m}
            style={[
              styles.modalOption,
              minutesRaw === String(m) && styles.modalOptionActive,
            ]}
            onPress={() => {
              setMinutesRaw(String(m));
              setMinutesOpen(false);
            }}
          >
            <Text
              style={[
                styles.modalOptionText,
                minutesRaw === String(m) && styles.modalOptionTextActive,
              ]}
            >
              {m}
            </Text>
          </Pressable>
        ))}
      </BottomSheetModal>

      <UkonPickerModal
        visible={ukonOpen}
        onClose={() => setUkonOpen(false)}
        ukony={ukonyQuery.data}
        isLoading={ukonyQuery.isLoading}
        isError={ukonyQuery.isError}
        error={ukonyQuery.error}
        selectedNazov={selectedUkon?.nazov ?? null}
        onSelect={setSelectedUkon}
        onRetry={() => void ukonyQuery.refetch()}
      />
    </SafeAreaView>
  );
}

function DateChip({
  title,
  active,
  onPress,
  outline,
}: {
  title: string;
  active: boolean;
  onPress: () => void;
  outline?: boolean;
}) {
  return (
    <Pressable
      style={[
        styles.dateChip,
        outline ? styles.dateChipOutline : styles.dateChipFill,
        active &&
          (outline ? styles.dateChipOutlineActive : styles.dateChipActive),
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.dateChipText,
          outline && styles.dateChipTextOutline,
          active &&
            (outline
              ? styles.dateChipTextOutlineActive
              : styles.dateChipTextActive),
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xl },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  backBtn: {
    minWidth: 72,
    paddingVertical: spacing.xs,
  },
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
  userHint: {
    fontSize: font.sm,
    color: colors.muted,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontSize: font.lg,
    fontWeight: "800",
    color: colors.text,
    marginTop: spacing.sm,
  },
  label: {
    fontSize: font.md,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.sm,
  },
  labelInline: {
    fontSize: font.md,
    fontWeight: "700",
    color: colors.text,
  },
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
  success: {
    fontSize: font.md,
    color: colors.success,
    fontWeight: "700",
  },
  dateRow: {
    flexDirection: "row",
    gap: 4,
  },
  dateChip: {
    flex: 1,
    minHeight: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
    paddingVertical: spacing.xs,
  },
  dateChipFill: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dateChipOutline: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.card,
  },
  dateChipOutlineActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dateChipText: {
    fontSize: font.xs,
    fontWeight: "700",
    color: colors.primary,
    textAlign: "center",
  },
  dateChipTextActive: { color: colors.primaryText },
  dateChipTextOutline: { color: colors.primary },
  dateChipTextOutlineActive: { color: colors.primaryText },
  dateValue: {
    fontSize: font.md,
    fontWeight: "600",
    color: colors.text,
  },
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
  noteInput: {
    minHeight: 64,
    paddingTop: spacing.sm,
    textAlignVertical: "top",
  },
  selectedInline: { gap: 2 },
  selectedLabel: {
    fontSize: font.md,
    fontWeight: "700",
    color: colors.text,
    lineHeight: 20,
  },
  selectedSub: { fontSize: font.sm, color: colors.muted },
  minutesRow: {
    flexDirection: "row",
    gap: spacing.xs,
    alignItems: "center",
  },
  minutesDropdown: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
  },
  minutesManual: {
    width: 88,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.sm,
    fontSize: font.lg,
    color: colors.text,
    textAlign: "center",
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
  reworkRow: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
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
  modalOption: {
    minHeight: 44,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  modalOptionActive: { backgroundColor: colors.primarySoft },
  modalOptionText: { fontSize: font.lg, color: colors.text, fontWeight: "600" },
  modalOptionTextActive: { color: colors.primary },
});
