import React from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, font, spacing } from "../../theme";

/** Varovanie s možnosťou pokračovať. true = používateľ pokračuje. */
export function potvrditAsync(
  title: string,
  message: string,
  confirmText = "Pokračovať",
): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: "Opraviť", style: "cancel", onPress: () => resolve(false) },
        { text: confirmText, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export function VolbaDvoch<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T | null;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.row}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            style={[styles.option, active && styles.optionActive]}
            disabled={disabled}
            onPress={() => onChange(o.value)}
          >
            <Text style={[styles.optionText, active && styles.optionTextActive]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Kladné celé číslo km, inak null. */
export function parseKm(raw: string): number | null {
  const s = raw.replace(/\s/g, "");
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
}

export const krokStyles = StyleSheet.create({
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
  backBtnText: { fontSize: font.md, fontWeight: "700", color: colors.primary },
  topBarTitle: { fontSize: font.lg, fontWeight: "800", color: colors.text },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 2,
  },
  summaryTitle: { fontSize: font.md, fontWeight: "800", color: colors.text },
  summarySub: { fontSize: font.md, fontWeight: "600", color: colors.primary },
  label: {
    fontSize: font.md,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.sm,
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
  multiline: {
    minHeight: 88,
    paddingTop: spacing.sm,
    textAlignVertical: "top",
  },
  muted: { fontSize: font.sm, color: colors.muted, lineHeight: 18 },
  error: { fontSize: font.sm, color: colors.danger, lineHeight: 18 },
  progress: {
    fontSize: font.md,
    fontWeight: "700",
    color: colors.primary,
    textAlign: "center",
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
  submitText: { color: colors.primaryText, fontSize: font.lg, fontWeight: "800" },
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm },
  option: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  optionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  optionText: { fontSize: font.md, fontWeight: "600", color: colors.text },
  optionTextActive: { color: colors.primary, fontWeight: "800" },
});
