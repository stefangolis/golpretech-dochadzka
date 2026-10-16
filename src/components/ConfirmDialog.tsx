import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { cs } from "../i18n/cs";
import { colors, font, spacing } from "../theme";
import { BottomSheetModal } from "./BottomSheetModal";

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Len jedno tlačidlo (OK) — bez Zrušiť. */
  hideCancel?: boolean;
  destructive?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
};

/** Potvrdzovací dialóg v appke (spodný panel). */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = cs.spolecne.ne,
  hideCancel = false,
  destructive = false,
  busy = false,
  error,
  onConfirm,
  onClose,
}: Props) {
  return (
    <BottomSheetModal
      visible={visible}
      title={title}
      onClose={busy ? () => undefined : onClose}
      dismissOnBackdrop={!busy}
    >
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {error ? (
        <Text style={styles.error} selectable>
          {error}
        </Text>
      ) : null}
      <View style={styles.row}>
        {hideCancel ? null : (
          <Pressable
            style={[styles.btn, styles.cancel, busy && styles.disabled]}
            disabled={busy}
            onPress={onClose}
          >
            <Text style={styles.cancelText}>{cancelLabel}</Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.btn, destructive ? styles.danger : styles.primary, busy && styles.disabled]}
          disabled={busy}
          onPress={onConfirm}
        >
          {busy ? (
            <ActivityIndicator color={destructive ? colors.danger : colors.primaryText} />
          ) : (
            <Text style={destructive ? styles.dangerText : styles.primaryText}>
              {confirmLabel}
            </Text>
          )}
        </Pressable>
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  message: { fontSize: font.md, color: colors.text, lineHeight: 21 },
  error: { fontSize: font.sm, color: colors.danger, lineHeight: 18 },
  row: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  btn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  cancel: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.primarySoft },
  cancelText: { fontSize: font.md, fontWeight: "700", color: colors.primary },
  primary: { backgroundColor: colors.primary },
  primaryText: { fontSize: font.md, fontWeight: "800", color: colors.primaryText },
  danger: { borderWidth: 1.5, borderColor: colors.danger, backgroundColor: "#FCEBEA" },
  dangerText: { fontSize: font.md, fontWeight: "800", color: colors.danger },
  disabled: { opacity: 0.5 },
});
