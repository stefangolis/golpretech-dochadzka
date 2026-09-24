import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { BottomSheetModal } from "./BottomSheetModal";
import { CalendarModal } from "./CalendarModal";
import { UkonPickerModal } from "./UkonPickerModal";
import { WorkItemPickerModal } from "./WorkItemPickerModal";
import { findUkonByNazov } from "../api/ukonFields";
import { enrichZakazkyLookupForEntries } from "../api/workData";
import { MINUTE_PRESETS } from "../constants/minutes";
import { useAuth } from "../auth/AuthContext";
import { useUpdateTimeEntry } from "../hooks/useMyEntries";
import { useUkony } from "../hooks/useUkony";
import { useWorkCatalog } from "../hooks/useWorkItems";
import { formatTimeEntryWorkLine, type ZakazkaLookup } from "../api/workItemsPicker";
import { colors, font, spacing } from "../theme";
import type { UkonItem } from "../types/ukon";
import type { TimeEntry, WorkItem } from "../types/workItems";
import {
  daysAgoDateOnly,
  formatDateShort,
  formatDateSk,
  isEditableEntryDate,
  myEntriesMinDateOnly,
  todayDateOnly,
} from "../utils/dates";
import type { EntrySelection } from "../utils/validation";
import { parseMinutes, validateTimeEntryEdit } from "../utils/validation";

const COLLAPSED_COUNT = 3;

type Props = {
  entries: TimeEntry[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
};

export function MyEntriesSection({
  entries,
  isLoading,
  isError,
  error,
}: Props) {
  const { getValidAccessToken } = useAuth();
  const workCatalogQuery = useWorkCatalog();
  const catalogLookup = workCatalogQuery.data?.zakazkyById;
  const [extraLookup, setExtraLookup] = useState<ZakazkaLookup>({});
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState<TimeEntry | null>(null);

  const zakazkyById = useMemo(
    () => ({ ...(catalogLookup ?? {}), ...extraLookup }),
    [catalogLookup, extraLookup],
  );

  useEffect(() => {
    const ids = (entries ?? []).map((e) => e.zakazkaId).filter(Boolean);
    if (ids.length === 0 || !catalogLookup) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getValidAccessToken();
        const enriched = await enrichZakazkyLookupForEntries(
          token,
          catalogLookup,
          ids,
        );
        if (cancelled) return;
        const extras: ZakazkaLookup = {};
        for (const [key, value] of Object.entries(enriched)) {
          if (!catalogLookup[key]) extras[key] = value;
        }
        setExtraLookup(extras);
      } catch {
        /* historický názov ostane kód */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entries, catalogLookup, getValidAccessToken]);

  const allEntries = entries ?? [];
  const visibleEntries = expanded
    ? allEntries
    : allEntries.slice(0, COLLAPSED_COUNT);
  const showToggle = allEntries.length > 0;
  const toggleLabel = expanded
    ? "Skryť"
    : allEntries.length > COLLAPSED_COUNT
      ? `Zobraziť všetky (${allEntries.length})`
      : "Upraviť záznamy";

  return (
    <>
      <Text style={styles.sectionTitle}>Moje záznamy</Text>
      <Text style={styles.sectionHint}>Posledný týždeň</Text>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : isError ? (
        <Text style={styles.error}>
          {error instanceof Error
            ? error.message
            : "Nepodarilo sa načítať záznamy."}
        </Text>
      ) : allEntries.length === 0 ? (
        <Text style={styles.muted}>Zatiaľ žiadne záznamy.</Text>
      ) : (
        <View style={styles.card}>
          {visibleEntries.map((e, idx) => {
            const editable = expanded && isEditableEntryDate(e.datum);
            return (
              <Pressable
                key={e.id}
                disabled={!editable}
                onPress={() => editable && setEditing(e)}
                style={[
                  styles.entryRow,
                  idx < visibleEntries.length - 1 && styles.entryBorder,
                  editable && styles.entryRowEditable,
                ]}
              >
                <Text style={styles.entryMain}>
                  {formatDateSk(e.datum)} · {e.minuty} min
                  {e.ukon ? ` · ${e.ukon}` : ""}
                  {e.rework ? " · Rework" : ""}
                </Text>
                <Text style={styles.entrySub} numberOfLines={2}>
                  {formatTimeEntryWorkLine(e, zakazkyById)}
                  {e.poznamka ? ` · ${e.poznamka}` : ""}
                </Text>
                {editable ? (
                  <Text style={styles.entryEditHint}>Klepnutím upravíte</Text>
                ) : null}
              </Pressable>
            );
          })}

          {showToggle ? (
            <Pressable
              style={styles.expandBtn}
              onPress={() => setExpanded((v) => !v)}
            >
              <Text style={styles.expandBtnText}>{toggleLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      <EditEntryModal
        entry={editing}
        zakazkyById={zakazkyById}
        onClose={() => setEditing(null)}
      />
    </>
  );
}

function workKeyFromEntry(entry: TimeEntry): string | null {
  if (entry.cisloObjednavky) return `o:${entry.cisloObjednavky}`;
  if (entry.zakazkaId) return `z:${entry.zakazkaId}`;
  return null;
}

function buildSelection(
  selectedItem: WorkItem | null,
  entry: TimeEntry,
): EntrySelection | null {
  if (selectedItem) {
    return selectedItem.kind === "zakazka"
      ? {
          kind: "zakazka",
          zakazkaId: selectedItem.zakazkaId,
          cisloObjednavky: "",
        }
      : {
          kind: "objednavka",
          zakazkaId: selectedItem.zakazkaId,
          cisloObjednavky: selectedItem.cisloObjednavky,
        };
  }
  if (entry.cisloObjednavky) {
    return {
      kind: "objednavka",
      zakazkaId: entry.zakazkaId,
      cisloObjednavky: entry.cisloObjednavky,
    };
  }
  if (entry.zakazkaId) {
    return { kind: "zakazka", zakazkaId: entry.zakazkaId, cisloObjednavky: "" };
  }
  return null;
}

function EditEntryModal({
  entry,
  zakazkyById,
  onClose,
}: {
  entry: TimeEntry | null;
  zakazkyById: ZakazkaLookup;
  onClose: () => void;
}) {
  const updateEntry = useUpdateTimeEntry();
  const workCatalogQuery = useWorkCatalog();
  const ukonyQuery = useUkony();
  const editScrollRef = useRef<ScrollView>(null);
  const noteFocusedRef = useRef(false);
  const [dateOnly, setDateOnly] = useState(todayDateOnly());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [minutesRaw, setMinutesRaw] = useState("");
  const [selectedUkon, setSelectedUkon] = useState<UkonItem | null>(null);
  const [rework, setRework] = useState(false);
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [workOpen, setWorkOpen] = useState(false);
  const [minutesOpen, setMinutesOpen] = useState(false);
  const [ukonOpen, setUkonOpen] = useState(false);

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

  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidShow", () => {
      if (!noteFocusedRef.current) return;
      editScrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!entry) return;
    setDateOnly(entry.datum);
    setSelectedKey(workKeyFromEntry(entry));
    setMinutesRaw(String(entry.minuty));
    setRework(entry.rework);
    setNote(entry.poznamka);
    setFormError(null);

    const fromList = findUkonByNazov(ukonyQuery.data ?? [], entry.ukon);
    if (fromList) {
      setSelectedUkon(fromList);
    } else if (entry.ukon) {
      setSelectedUkon({
        id: `stored:${entry.id}`,
        nazov: entry.ukon,
        label: entry.ukon,
      } as UkonItem);
    } else {
      setSelectedUkon(null);
    }
  }, [entry, ukonyQuery.data]);

  const onSave = async () => {
    if (!entry) return;
    if (!isEditableEntryDate(entry.datum)) {
      setFormError("Záznam starší ako týždeň nie je možné upraviť.");
      return;
    }

    const selection = buildSelection(selectedItem, entry);

    const validationError = validateTimeEntryEdit({
      selection,
      dateOnly,
      minutesRaw,
      ukon: selectedUkon?.nazov ?? null,
      validUkonNames,
      rework,
      poznamka: note,
    });
    if (validationError) {
      setFormError(validationError);
      return;
    }

    const minuty = parseMinutes(minutesRaw);
    if (minuty == null || !selectedUkon || !selection) return;

    setFormError(null);
    try {
      await updateEntry.mutateAsync({
        id: entry.id,
        datum: dateOnly,
        zakazkaId: selection.zakazkaId,
        cisloObjednavky: selection.cisloObjednavky,
        minuty,
        ukon: selectedUkon.nazov,
        rework,
        poznamka: note.trim(),
      });
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    }
  };

  const workDisplay = selectedItem ? (
    <View style={styles.selectedInline}>
      <Text style={styles.selectedLabel}>{selectedItem.label}</Text>
      {selectedItem.subtitle ? (
        <Text style={styles.selectedSub}>{selectedItem.subtitle}</Text>
      ) : null}
    </View>
  ) : entry && (entry.zakazkaId || entry.cisloObjednavky) ? (
    <Text style={styles.selectValue}>
      {formatTimeEntryWorkLine(entry, zakazkyById)}
    </Text>
  ) : (
    <Text style={styles.selectPlaceholder}>Vyberte zákazku alebo objednávku…</Text>
  );

  return (
    <>
      <BottomSheetModal
        visible={entry != null}
        title="Upraviť záznam"
        onClose={onClose}
        tall
        dismissOnBackdrop={false}
      >
        {entry ? (
          <KeyboardAvoidingView
            style={styles.editFlex}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <ScrollView
              ref={editScrollRef}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.editScrollContent}
            >
            <Text style={styles.label}>Dátum *</Text>
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

            <Text style={styles.label}>Zákazka / objednávka *</Text>
            <Pressable
              style={styles.selectBtn}
              onPress={() => setWorkOpen(true)}
            >
              {workDisplay}
            </Pressable>

            <Text style={styles.label}>Minúty *</Text>
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

            <Text style={styles.label}>Úkon *</Text>
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

            <View style={styles.reworkRow}>
              <Text style={styles.labelInline}>Rework</Text>
              <Switch
                value={rework}
                onValueChange={setRework}
                trackColor={{
                  false: colors.border,
                  true: colors.primaryMuted,
                }}
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

            <Pressable
              style={[
                styles.saveBtn,
                updateEntry.isPending && styles.saveBtnDisabled,
              ]}
              disabled={updateEntry.isPending}
              onPress={() => {
                Keyboard.dismiss();
                void onSave();
              }}
            >
              {updateEntry.isPending ? (
                <ActivityIndicator color={colors.primaryText} />
              ) : (
                <Text style={styles.saveBtnText}>Uložiť zmeny</Text>
              )}
            </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        ) : null}
      </BottomSheetModal>

      <CalendarModal
        visible={calendarOpen}
        selected={dateOnly}
        onSelect={setDateOnly}
        onClose={() => setCalendarOpen(false)}
        minDate={myEntriesMinDateOnly()}
      />

      <WorkItemPickerModal
        visible={workOpen}
        selectedKey={selectedKey}
        onSelect={(item) => setSelectedKey(item.key)}
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
    </>
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
  sectionTitle: {
    fontSize: font.lg,
    fontWeight: "800",
    color: colors.text,
    marginTop: spacing.sm,
  },
  sectionHint: { fontSize: font.sm, color: colors.muted, marginTop: -4 },
  muted: { fontSize: font.sm, color: colors.muted, lineHeight: 18 },
  error: { fontSize: font.sm, color: colors.danger, lineHeight: 18 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  entryRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  entryRowEditable: {
    backgroundColor: colors.bg,
  },
  entryBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  entryMain: { fontSize: font.md, fontWeight: "700", color: colors.text },
  entrySub: { fontSize: font.sm, color: colors.muted },
  entryEditHint: {
    fontSize: font.xs,
    color: colors.primary,
    fontWeight: "600",
    marginTop: 2,
  },
  expandBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: "center",
  },
  expandBtnText: {
    fontSize: font.md,
    fontWeight: "700",
    color: colors.primary,
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
    marginBottom: spacing.xs,
  },
  selectedInline: { gap: 2 },
  selectedLabel: {
    fontSize: font.md,
    fontWeight: "700",
    color: colors.text,
    lineHeight: 20,
  },
  selectedSub: { fontSize: font.sm, color: colors.muted },
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
  saveBtn: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  editFlex: { flex: 1 },
  editScrollContent: { paddingBottom: spacing.xl * 3 },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: {
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
  ukonList: { maxHeight: 320 },
  modalList: { flex: 1, maxHeight: 360 },
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
