import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, font, spacing } from "../theme";
import {
  minEntryDateOnly,
  parseDateOnly,
  todayDateOnly,
  toDateOnly,
} from "../utils/dates";

type Props = {
  visible: boolean;
  selected: string;
  onSelect: (dateOnly: string) => void;
  onClose: () => void;
  /** Najstarší povolený dátum (default: posledný týždeň pre nový zápis) */
  minDate?: string;
};

const WEEKDAYS = ["Po", "Ut", "St", "Št", "Pi", "So", "Ne"];

function monthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

/** Pondelok = 0 … Nedeľa = 6 */
function weekdayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function CalendarModal({
  visible,
  selected,
  onSelect,
  onClose,
  minDate: minDateProp,
}: Props) {
  const insets = useSafeAreaInsets();
  const minDate = minDateProp ?? minEntryDateOnly();
  const maxDate = todayDateOnly();

  const [viewMonth, setViewMonth] = useState(() =>
    monthStart(parseDateOnly(selected || todayDateOnly())),
  );

  useEffect(() => {
    if (visible) {
      setViewMonth(monthStart(parseDateOnly(selected || todayDateOnly())));
    }
  }, [visible, selected]);

  const cells = useMemo(() => {
    const first = monthStart(viewMonth);
    const startPad = weekdayIndex(first);
    const daysInMonth = new Date(
      viewMonth.getFullYear(),
      viewMonth.getMonth() + 1,
      0,
    ).getDate();

    const out: Array<{ key: string; dateOnly: string | null }> = [];
    for (let i = 0; i < startPad; i += 1) {
      out.push({ key: `pad-${i}`, dateOnly: null });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const d = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
      out.push({ key: toDateOnly(d), dateOnly: toDateOnly(d) });
    }
    return out;
  }, [viewMonth]);

  const monthLabel = viewMonth.toLocaleDateString("sk-SK", {
    month: "long",
    year: "numeric",
  });

  const canPrev =
    toDateOnly(addMonths(viewMonth, -1)) >= toDateOnly(monthStart(parseDateOnly(minDate)));
  const canNext =
    toDateOnly(addMonths(viewMonth, 1)) <= toDateOnly(monthStart(parseDateOnly(maxDate)));

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { marginBottom: insets.bottom }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={styles.title}>Vyberte dátum</Text>

          <View style={styles.navRow}>
            <Pressable
              style={[styles.navBtn, !canPrev && styles.navBtnDisabled]}
              disabled={!canPrev}
              onPress={() => setViewMonth((m) => addMonths(m, -1))}
            >
              <Text style={styles.navBtnText}>‹</Text>
            </Pressable>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <Pressable
              style={[styles.navBtn, !canNext && styles.navBtnDisabled]}
              disabled={!canNext}
              onPress={() => setViewMonth((m) => addMonths(m, 1))}
            >
              <Text style={styles.navBtnText}>›</Text>
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAYS.map((w) => (
              <Text key={w} style={styles.weekday}>
                {w}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((cell) => {
              if (!cell.dateOnly) {
                return <View key={cell.key} style={styles.dayCell} />;
              }
              const enabled =
                cell.dateOnly >= minDate && cell.dateOnly <= maxDate;
              const isSelected = cell.dateOnly === selected;
              const dayNum = parseDateOnly(cell.dateOnly).getDate();
              return (
                <Pressable
                  key={cell.key}
                  style={[
                    styles.dayCell,
                    enabled && styles.dayCellEnabled,
                    isSelected && styles.dayCellSelected,
                  ]}
                  disabled={!enabled}
                  onPress={() => {
                    onSelect(cell.dateOnly!);
                    onClose();
                  }}
                >
                  <Text
                    style={[
                      styles.dayText,
                      !enabled && styles.dayTextDisabled,
                      isSelected && styles.dayTextSelected,
                    ]}
                  >
                    {dayNum}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    fontSize: font.lg,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  navBtnDisabled: { opacity: 0.35 },
  navBtnText: {
    fontSize: font.xl,
    fontWeight: "700",
    color: colors.primary,
    lineHeight: 24,
  },
  monthLabel: {
    fontSize: font.md,
    fontWeight: "700",
    color: colors.text,
    textTransform: "capitalize",
  },
  weekRow: {
    flexDirection: "row",
    marginTop: spacing.xs,
  },
  weekday: {
    flex: 1,
    textAlign: "center",
    fontSize: font.xs,
    fontWeight: "700",
    color: colors.muted,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 2,
  },
  dayCellEnabled: {
    borderRadius: 999,
  },
  dayCellSelected: {
    backgroundColor: colors.primary,
  },
  dayText: {
    fontSize: font.md,
    fontWeight: "600",
    color: colors.text,
  },
  dayTextDisabled: {
    color: colors.border,
  },
  dayTextSelected: {
    color: colors.primaryText,
    fontWeight: "800",
  },
});
