import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, font, spacing } from "../theme";
import {
  formatDateSk,
  inclusiveDayCount,
  parseDateOnly,
  toDateOnly,
} from "../utils/dates";

type Props = {
  visible: boolean;
  od: string;
  doDate: string;
  minDate: string;
  maxDate: string;
  /** Maximálny počet dní rozsahu (vrátane). */
  maxDays?: number;
  /** Dni, keď je vybrané vozidlo už obsadené (YYYY-MM-DD). */
  busyDates?: ReadonlySet<string>;
  /** Od je zamknuté (môže byť aj pred minDate), ťuknutie mení len Do. */
  fixedStart?: boolean;
  title?: string;
  onConfirm: (od: string, doDate: string) => void;
  onClose: () => void;
};

function initialMonth(od: string, minDate: string): Date {
  const anchor = od && od > minDate ? od : minDate;
  return monthStart(parseDateOnly(anchor));
}

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

function rangeHasBusy(
  od: string,
  doDate: string,
  busy: ReadonlySet<string> | undefined,
): boolean {
  if (!busy || busy.size === 0) return false;
  for (const d of busy) {
    if (d >= od && d <= doDate) return true;
  }
  return false;
}

/**
 * Kalendár na výber rozsahu: prvé ťuknutie = Od, druhé = Do.
 * Ďalšie ťuknutie začne nový výber.
 */
export function RangeCalendarModal({
  visible,
  od,
  doDate,
  minDate,
  maxDate,
  maxDays,
  busyDates,
  fixedStart = false,
  title = "Termín rezervácie",
  onConfirm,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const [start, setStart] = useState<string | null>(od || null);
  const [end, setEnd] = useState<string | null>(doDate || null);
  const [hint, setHint] = useState<string | null>(null);
  const [viewMonth, setViewMonth] = useState(() =>
    initialMonth(od, minDate),
  );

  useEffect(() => {
    if (!visible) return;
    setStart(od || null);
    setEnd(doDate || null);
    setHint(null);
    setViewMonth(initialMonth(od, minDate));
  }, [visible, od, doDate, minDate]);

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
    toDateOnly(addMonths(viewMonth, -1)) >=
    toDateOnly(monthStart(parseDateOnly(minDate)));
  const canNext =
    toDateOnly(addMonths(viewMonth, 1)) <=
    toDateOnly(monthStart(parseDateOnly(maxDate)));

  const onDayPress = (d: string) => {
    setHint(null);
    if (busyDates?.has(d)) {
      setHint("Vozidlo je v tento deň už rezervované.");
      return;
    }
    if (fixedStart) {
      if (!start || d < start) return;
    } else if (!start || end || d < start) {
      // Začať nový výber
      setStart(d);
      setEnd(null);
      return;
    }
    if (rangeHasBusy(start, d, busyDates)) {
      setHint("V zvolenom období je vozidlo už rezervované. Vyberte kratší úsek.");
      return;
    }
    if (maxDays && inclusiveDayCount(start, d) > maxDays) {
      setHint(`Maximálna dĺžka rezervácie je ${maxDays} dní.`);
      return;
    }
    setEnd(d);
  };

  const effectiveEnd = end ?? start;
  const summary = start
    ? effectiveEnd && effectiveEnd !== start
      ? `${formatDateSk(start)} – ${formatDateSk(effectiveEnd)} (${inclusiveDayCount(start, effectiveEnd)} dní)`
      : `${formatDateSk(start)} (1 deň)`
    : "Ťuknite na prvý deň";

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { marginBottom: insets.bottom }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.help}>
            {fixedStart
              ? "Začiatok sa nemení — ťuknite na nový posledný deň"
              : start && !end
                ? "Ťuknite na posledný deň (alebo potvrďte 1 deň)"
                : "Ťuknite na prvý a potom na posledný deň"}
          </Text>

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
              const d = cell.dateOnly;
              const enabled = d >= minDate && d <= maxDate;
              const busy = !!busyDates?.has(d);
              const isEndpoint = d === start || d === effectiveEnd;
              const inRange =
                !!start && !!effectiveEnd && d > start && d < effectiveEnd;
              return (
                <Pressable
                  key={cell.key}
                  style={styles.dayCell}
                  disabled={!enabled}
                  onPress={() => onDayPress(d)}
                >
                  <View
                    style={[
                      styles.dayInner,
                      inRange && styles.dayInRange,
                      isEndpoint && styles.dayEndpoint,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        !enabled && styles.dayTextDisabled,
                        enabled && busy && styles.dayTextBusy,
                        isEndpoint && styles.dayTextSelected,
                      ]}
                    >
                      {parseDateOnly(d).getDate()}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {busyDates && busyDates.size > 0 ? (
            <Text style={styles.legend}>
              Červené dni = vozidlo je už rezervované
            </Text>
          ) : null}

          <Text style={styles.summary}>{summary}</Text>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}

          <View style={styles.btnRow}>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Zrušiť</Text>
            </Pressable>
            <Pressable
              style={[styles.okBtn, !start && styles.okBtnDisabled]}
              disabled={!start}
              onPress={() => {
                if (!start) return;
                onConfirm(start, end ?? start);
                onClose();
              }}
            >
              <Text style={styles.okText}>Potvrdiť</Text>
            </Pressable>
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
  help: {
    fontSize: font.sm,
    color: colors.muted,
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
  weekRow: { flexDirection: "row", marginTop: spacing.xs },
  weekday: {
    flex: 1,
    textAlign: "center",
    fontSize: font.xs,
    fontWeight: "700",
    color: colors.muted,
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 2,
  },
  dayInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  dayInRange: {
    backgroundColor: colors.primarySoft,
    borderRadius: 6,
  },
  dayEndpoint: { backgroundColor: colors.primary },
  dayText: { fontSize: font.md, fontWeight: "600", color: colors.text },
  dayTextDisabled: { color: colors.border },
  dayTextBusy: {
    color: colors.danger,
    textDecorationLine: "line-through",
  },
  dayTextSelected: { color: colors.primaryText, fontWeight: "800" },
  legend: { fontSize: font.xs, color: colors.danger, textAlign: "center" },
  summary: {
    fontSize: font.md,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  hint: { fontSize: font.sm, color: colors.danger, textAlign: "center" },
  btnRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: "center",
  },
  cancelText: { fontSize: font.md, fontWeight: "700", color: colors.primary },
  okBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
  },
  okBtnDisabled: { opacity: 0.4 },
  okText: { fontSize: font.md, fontWeight: "700", color: colors.primaryText },
});
