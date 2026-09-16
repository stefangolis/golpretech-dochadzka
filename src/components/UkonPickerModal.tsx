import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from "react-native";
import { BottomSheetModal } from "./BottomSheetModal";
import { colors, font, spacing } from "../theme";
import type { UkonItem } from "../types/ukon";

type Props = {
  visible: boolean;
  onClose: () => void;
  ukony: UkonItem[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  selectedNazov: string | null;
  onSelect: (item: UkonItem) => void;
};

export function UkonPickerModal({
  visible,
  onClose,
  ukony,
  isLoading,
  isError,
  error,
  selectedNazov,
  onSelect,
}: Props) {
  return (
    <BottomSheetModal visible={visible} title="Úkon" onClose={onClose}>
      {isLoading ? (
        <ActivityIndicator
          style={{ marginVertical: spacing.md }}
          color={colors.primary}
        />
      ) : isError ? (
        <Text style={styles.error}>
          {error instanceof Error
            ? error.message
            : "Nepodarilo sa načítať úkony."}
        </Text>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" style={styles.list}>
          {(ukony ?? []).map((item) => (
            <Pressable
              key={item.id}
              style={[
                styles.option,
                selectedNazov === item.nazov && styles.optionActive,
              ]}
              onPress={() => {
                onSelect(item);
                onClose();
              }}
            >
              <Text
                style={[
                  styles.optionText,
                  selectedNazov === item.nazov && styles.optionTextActive,
                ]}
              >
                {item.nazov}
              </Text>
            </Pressable>
          ))}
          {(ukony?.length ?? 0) === 0 ? (
            <Text style={styles.muted}>Zoznam úkonov je prázdny.</Text>
          ) : null}
        </ScrollView>
      )}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  list: { maxHeight: 320 },
  option: {
    minHeight: 44,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
    backgroundColor: colors.bg,
    marginBottom: spacing.xs,
  },
  optionActive: { backgroundColor: colors.primarySoft },
  optionText: { fontSize: font.lg, color: colors.text, fontWeight: "600" },
  optionTextActive: { color: colors.primary },
  muted: { fontSize: font.sm, color: colors.muted },
  error: { fontSize: font.sm, color: colors.danger },
});
