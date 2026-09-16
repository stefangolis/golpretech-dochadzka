import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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
import { useAuth } from "../auth/AuthContext";
import { BottomSheetModal } from "../components/BottomSheetModal";
import { CalendarModal } from "../components/CalendarModal";
import { MyEntriesSection } from "../components/MyEntriesSection";
import { UkonPickerModal } from "../components/UkonPickerModal";
import { MINUTE_PRESETS } from "../constants/minutes";
import { useCreateTimeEntry, useMyEntries } from "../hooks/useMyEntries";
import { useUkony } from "../hooks/useUkony";
import { useWorkCatalog } from "../hooks/useWorkItems";
import { colors, font, spacing } from "../theme";
import type { UkonItem } from "../types/ukon";
import type { WorkItem } from "../types/workItems";
import {
  daysAgoDateOnly,
  formatDateShort,
  formatDateSk,
  todayDateOnly,
} from "../utils/dates";
import { parseMinutes, validateTimeEntry } from "../utils/validation";

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const { user, signOut } = useAuth();
  const workCatalogQuery = useWorkCatalog();
  const ukonyQuery = useUkony();
  const myEntriesQuery = useMyEntries();
  const createEntry = useCreateTimeEntry();

  const [workSearch, setWorkSearch] = useState("");
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

  const filteredWorkItems = useMemo(() => {
    const q = workSearch.trim().toLowerCase();
    if (!q) return pickerItems;
    return pickerItems.filter((i) => i.searchText.includes(q));
  }, [workSearch, pickerItems]);

  const validUkonNames = useMemo(
    () => ukonyQuery.data?.map((u) => u.nazov) ?? [],
    [ukonyQuery.data],
  );

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
        minutovaSadzba: selectedUkon.minutovaSadzba,
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

  const scrollToNote = () => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, Platform.OS === "ios" ? 280 : 120);
  };

  const bottomPad = insets.bottom + spacing.xl + spacing.md;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
        <View style={styles.header}>
          <View style={styles.hero}>
            <View style={{ flex: 1 }}>
              <Text style={styles.brand}>Golpretech</Text>
              <Text style={styles.userName} numberOfLines={1}>
                {user?.displayName}
              </Text>
              <Text style={styles.userEmail} numberOfLines={1}>
                {user?.email}
              </Text>
            </View>
            <Pressable style={styles.logoutBtn} onPress={() => void signOut()}>
              <Text style={styles.logoutText}>Odhlásiť</Text>
            </Pressable>
          </View>

          <MyEntriesSection
            entries={myEntriesQuery.data}
            isLoading={myEntriesQuery.isLoading}
            isError={myEntriesQuery.isError}
            error={myEntriesQuery.error}
          />

          <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>
            Nový zápis
          </Text>

          {/* 1. Dátum */}
          <Text style={styles.label}>1. Dátum</Text>
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

          {/* 2. Zákazka / objednávka */}
          <Text style={styles.label}>2. Zákazka / objednávka</Text>
          <Pressable
            style={styles.selectBtn}
            onPress={() => {
              setWorkSearch("");
              setWorkOpen(true);
            }}
          >
            {selectedItem ? (
              <View style={styles.selectedInline}>
                <Text style={styles.selectedLabel}>{selectedItem.label}</Text>
                {selectedItem.subtitle ? (
                  <Text style={styles.selectedSub}>{selectedItem.subtitle}</Text>
                ) : null}
              </View>
            ) : (
              <Text style={styles.selectPlaceholder}>
                Vyberte zákazku alebo objednávku…
              </Text>
            )}
          </Pressable>

          {/* 3. Minúty */}
          <Text style={styles.label}>3. Minúty (1–720)</Text>
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

          {/* 4. Úkon */}
          <Text style={styles.label}>4. Úkon</Text>
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

          {/* 5. Rework */}
          <View style={styles.reworkRow}>
            <Text style={styles.labelInline}>Rework</Text>
            <Switch
              value={rework}
              onValueChange={setRework}
              trackColor={{ false: colors.border, true: colors.primaryMuted }}
              thumbColor={rework ? colors.primary : "#f4f4f4"}
            />
          </View>

          {/* 6. Poznámka */}
          <Text style={styles.label}>
            Poznámka{rework ? " *" : ""}
          </Text>
          <TextInput
            style={[styles.input, styles.noteInput]}
            value={note}
            onChangeText={setNote}
            placeholder={rework ? "Povinná pri Rework" : "Voliteľná"}
            placeholderTextColor={colors.muted}
            multiline
            onFocus={scrollToNote}
          />

          {formError ? (
            <Text style={styles.error} selectable>
              {formError}
            </Text>
          ) : null}
          {successMsg ? <Text style={styles.success}>{successMsg}</Text> : null}

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

      <BottomSheetModal
        visible={workOpen}
        title="Zákazka / objednávka"
        onClose={() => setWorkOpen(false)}
        tall
        dismissOnBackdrop={false}
      >
        <TextInput
          style={styles.input}
          value={workSearch}
          onChangeText={setWorkSearch}
          placeholder="Hľadať kód, názov, zákazníka…"
          placeholderTextColor={colors.muted}
          autoCorrect={false}
          autoCapitalize="none"
          autoFocus
        />
        {workCatalogQuery.isLoading ? (
          <ActivityIndicator
            style={{ marginVertical: spacing.md }}
            color={colors.primary}
          />
        ) : workCatalogQuery.isError ? (
          <Text style={styles.error}>
            {workCatalogQuery.error instanceof Error
              ? workCatalogQuery.error.message
              : "Nepodarilo sa načítať zoznam."}
          </Text>
        ) : (
          <FlatList
            data={filteredWorkItems}
            keyExtractor={(item) => item.key}
            keyboardShouldPersistTaps="handled"
            style={styles.modalList}
            ListEmptyComponent={
              <Text style={styles.muted}>Nič nenájdené.</Text>
            }
            renderItem={({ item }) => (
              <WorkItemOption
                item={item}
                selected={item.key === selectedKey}
                onPress={() => {
                  setSelectedKey(item.key);
                  setWorkOpen(false);
                  setSuccessMsg(null);
                  setFormError(null);
                }}
              />
            )}
          />
        )}
        <Pressable
          style={styles.modalCloseBtn}
          onPress={() => setWorkOpen(false)}
        >
          <Text style={styles.modalCloseText}>Zavrieť</Text>
        </Pressable>
      </BottomSheetModal>

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

function WorkItemOption({
  item,
  selected,
  onPress,
}: {
  item: WorkItem;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.workOption, selected && styles.workOptionSelected]}
    >
      <Text style={styles.workOptionLabel}>{item.label}</Text>
      {item.subtitle ? (
        <Text style={styles.workOptionSub}>{item.subtitle}</Text>
      ) : null}
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
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  brand: {
    fontSize: font.xs,
    fontWeight: "700",
    color: colors.primary,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  userName: { fontSize: font.xl, fontWeight: "800", color: colors.text },
  userEmail: { fontSize: font.sm, color: colors.primaryMuted },
  logoutBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  logoutText: { fontSize: font.sm, fontWeight: "700", color: colors.primary },
  sectionTitle: {
    fontSize: font.lg,
    fontWeight: "800",
    color: colors.text,
    marginTop: spacing.sm,
  },
  sectionHint: { fontSize: font.sm, color: colors.muted, marginTop: -4 },
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
  muted: { fontSize: font.sm, color: colors.muted, lineHeight: 18 },
  error: { fontSize: font.sm, color: colors.danger, lineHeight: 18 },
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
  modalList: { flex: 1 },
  ukonList: { maxHeight: 320 },
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
  modalCloseBtn: {
    marginTop: spacing.sm,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseText: {
    fontSize: font.md,
    fontWeight: "700",
    color: colors.primary,
  },
  workOption: {
    marginTop: spacing.xs,
    padding: spacing.md,
    borderRadius: 10,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  workOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  workOptionLabel: {
    fontSize: font.md,
    lineHeight: 20,
    color: colors.text,
    fontWeight: "700",
  },
  workOptionSub: { fontSize: font.sm, color: colors.muted },
});
