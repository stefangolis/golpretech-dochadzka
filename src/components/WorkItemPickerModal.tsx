import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";
import { useWorkCatalog } from "../hooks/useWorkItems";
import { colors, font, spacing } from "../theme";
import type { WorkItem } from "../types/workItems";
import { BottomSheetModal } from "./BottomSheetModal";

type Props = {
  visible: boolean;
  selectedKey: string | null;
  onSelect: (item: WorkItem) => void;
  onClose: () => void;
};

/** Znovupoužiteľný picker zákazky / objednávky (rovnaký ako v odvode). */
export function WorkItemPickerModal({
  visible,
  selectedKey,
  onSelect,
  onClose,
}: Props) {
  const workCatalogQuery = useWorkCatalog();
  const [workSearch, setWorkSearch] = useState("");

  const pickerItems = workCatalogQuery.data?.pickerItems ?? [];

  const filteredWorkItems = useMemo(() => {
    const q = workSearch.trim().toLowerCase();
    if (!q) return pickerItems;
    return pickerItems.filter((i) => i.searchText.includes(q));
  }, [workSearch, pickerItems]);

  return (
    <BottomSheetModal
      visible={visible}
      title="Zákazka / objednávka"
      onClose={onClose}
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
        autoFocus={visible}
      />
      {workCatalogQuery.isLoading ? (
        <ActivityIndicator
          style={{ marginVertical: spacing.md }}
          color={colors.primary}
        />
      ) : workCatalogQuery.isError ? (
        <>
          <Text style={styles.error} selectable>
            {workCatalogQuery.error instanceof Error
              ? workCatalogQuery.error.message
              : "Nepodarilo sa načítať zoznam."}
          </Text>
          <Pressable
            style={styles.retryBtn}
            onPress={() => void workCatalogQuery.refetch()}
          >
            <Text style={styles.retryBtnText}>Skúsiť znovu</Text>
          </Pressable>
        </>
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
                onSelect(item);
                onClose();
              }}
            />
          )}
        />
      )}
      <Pressable style={styles.modalCloseBtn} onPress={onClose}>
        <Text style={styles.modalCloseText}>Zavrieť</Text>
      </Pressable>
    </BottomSheetModal>
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
  muted: { fontSize: font.sm, color: colors.muted, lineHeight: 18 },
  error: { fontSize: font.sm, color: colors.danger, lineHeight: 18 },
  retryBtn: {
    alignSelf: "flex-start",
    marginTop: spacing.sm,
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
  modalList: { flex: 1 },
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
