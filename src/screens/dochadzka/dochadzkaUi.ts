import { useCallback, useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { formatDenKratce, formatMesicRok } from "../../i18n/datum";
import { colors, font, spacing } from "../../theme";
import { nfcTagZachyteny, zaregistrujNfcPopredie } from "../../utils/nfc";

/** "St 1. 10." z YYYY-MM-DD */
export function formatDenKratko(dateKey: string): string {
  return formatDenKratce(dateKey);
}

/** "Říjen 2026" */
export function formatMesiac(year: number, month: number): string {
  return formatMesicRok(year, month);
}

/** Aktuálny čas, obnovuje sa v danom intervale. */
export function useClock(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** Kým je obrazovka aktívna, priloženie nálepky otvorí Zápis (NFC v popredí). */
export function useNfcPopredieNaZapis(): void {
  useFocusEffect(
    useCallback(() => {
      let active = true;
      let off: (() => Promise<void>) | null = null;
      void zaregistrujNfcPopredie((tagUid) => {
        nfcTagZachyteny(tagUid);
      }).then((fn) => {
        if (active) off = fn;
        else void fn();
      });
      return () => {
        active = false;
        if (off) void off();
      };
    }, []),
  );
}

export const ui = StyleSheet.create({
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
  backBtnText: { fontSize: font.md, fontWeight: "700", color: colors.primary },
  topBarTitle: { fontSize: font.lg, fontWeight: "800", color: colors.text },
  sectionTitle: {
    fontSize: font.lg,
    fontWeight: "800",
    color: colors.text,
    marginTop: spacing.sm,
  },
  muted: { fontSize: font.sm, color: colors.muted, lineHeight: 18 },
  error: { fontSize: font.sm, color: colors.danger, lineHeight: 18 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  cardTitle: { fontSize: font.md, fontWeight: "800", color: colors.text },
  cardMeta: { fontSize: font.sm, color: colors.muted },
  successBox: {
    backgroundColor: "#E7F6EE",
    borderColor: colors.success,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: spacing.md,
  },
  successText: { fontSize: font.lg, fontWeight: "800", color: colors.success },
  warnText: { fontSize: font.sm, fontWeight: "700", color: colors.danger },
  primaryBtn: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  primaryBtnText: {
    color: colors.primaryText,
    fontSize: font.lg,
    fontWeight: "800",
  },
  secondaryBtn: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  secondaryBtnText: { color: colors.primary, fontSize: font.md, fontWeight: "700" },
  disabled: { opacity: 0.5 },
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 2,
  },
  eventTime: {
    fontSize: font.md,
    fontWeight: "800",
    color: colors.text,
    minWidth: 48,
  },
  eventTyp: { fontSize: font.md, color: colors.text, flex: 1 },
  eventZrusena: { textDecorationLine: "line-through", color: colors.muted },
  badge: {
    fontSize: font.xs,
    fontWeight: "700",
    color: colors.primaryMuted,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
  },
});
