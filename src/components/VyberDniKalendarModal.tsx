import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cs } from "../i18n/cs";
import { DNY_TYDNE_OD_PONDELI, formatDatumKratce, formatMesicRok } from "../i18n/datum";
import { colors, font, spacing } from "../theme";
import {
  dovodNevolitelnosti,
  mesiacKluca,
  mesiacVRozsahu,
  mriezkaMesiaca,
  posunMesiac,
  prepniDen,
  pridajRozsah,
  type PravidlaVyberu,
} from "../utils/vyberDni";

type Props = {
  visible: boolean;
  vybrane: readonly string[];
  pravidla: PravidlaVyberu;
  /** Mesiac, ktorý sa ukáže, ak ešte nie je nič vybrané (YYYY-MM-DD). */
  vychodziDen: string;
  title?: string;
  onConfirm: (vybrane: string[]) => void;
  onClose: () => void;
};

const OBSADENE = "#B54708";
const OBSADENE_POZADIE = "#FEF0C7";
const VIKEND_POZADIE = "#FBEAEA";

/** Ťuk = vybrať/zrušiť deň; režim „Vybrať rozsah" = ťuk na prvý a posledný deň. */
export function VyberDniKalendarModal({
  visible,
  vybrane,
  pravidla,
  vychodziDen,
  title = cs.kalendar.titulek,
  onConfirm,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const t = cs.kalendar;
  const [draft, setDraft] = useState<string[]>([...vybrane]);
  const [mesiac, setMesiac] = useState(() => mesiacKluca(vybrane[0] ?? vychodziDen));
  const [rezimRozsahu, setRezimRozsahu] = useState(false);
  const [zaciatokRozsahu, setZaciatokRozsahu] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setDraft([...vybrane].sort());
    setMesiac(mesiacKluca(vybrane[0] ?? vychodziDen));
    setRezimRozsahu(false);
    setZaciatokRozsahu(null);
    setHint(null);
    // Návrh výberu sa inicializuje len pri otvorení, nie pri každom renderi rodiča.
  }, [visible]);

  const bunky = useMemo(
    () => mriezkaMesiaca(mesiac.year, mesiac.month, draft, pravidla),
    [mesiac, draft, pravidla],
  );

  const pred = posunMesiac(mesiac.year, mesiac.month, -1);
  const po = posunMesiac(mesiac.year, mesiac.month, 1);
  const canPrev = mesiacVRozsahu(pred.year, pred.month, pravidla);
  const canNext = mesiacVRozsahu(po.year, po.month, pravidla);

  const onDen = (datum: string) => {
    if (rezimRozsahu) {
      if (!zaciatokRozsahu) {
        setZaciatokRozsahu(datum);
        setHint(null);
        return;
      }
      setDraft((d) => pridajRozsah(d, zaciatokRozsahu, datum, pravidla));
      setZaciatokRozsahu(null);
      setRezimRozsahu(false);
      setHint(null);
      return;
    }
    if (!draft.includes(datum)) {
      const dovod = dovodNevolitelnosti(datum, pravidla);
      if (dovod) {
        setHint(dovod);
        return;
      }
    }
    setHint(null);
    setDraft((d) => prepniDen(d, datum, pravidla));
  };

  const napoveda = rezimRozsahu
    ? zaciatokRozsahu
      ? `${t.napovedaRozsahPosledni} (${formatDatumKratce(zaciatokRozsahu)} – …)`
      : t.napovedaRozsahPrvni
    : t.napovedaVyber;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { marginBottom: insets.bottom }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.help}>{napoveda}</Text>

          <View style={styles.navRow}>
            <Pressable
              style={[styles.navBtn, !canPrev && styles.navBtnDisabled]}
              disabled={!canPrev}
              accessibilityLabel={t.predchoziMesic}
              onPress={() => setMesiac(pred)}
            >
              <Text style={styles.navBtnText}>‹</Text>
            </Pressable>
            <Text style={styles.monthLabel}>{formatMesicRok(mesiac.year, mesiac.month)}</Text>
            <Pressable
              style={[styles.navBtn, !canNext && styles.navBtnDisabled]}
              disabled={!canNext}
              accessibilityLabel={t.dalsiMesic}
              onPress={() => setMesiac(po)}
            >
              <Text style={styles.navBtnText}>›</Text>
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {DNY_TYDNE_OD_PONDELI.map((w, i) => (
              <Text key={w} style={[styles.weekday, i >= 5 && styles.weekdayVikend]}>
                {w}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {bunky.map((b, i) => {
              if (!b) return <View key={`pad-${i}`} style={styles.dayCell} />;
              const volny = b.vikend || b.sviatok;
              const jeZaciatok = b.datum === zaciatokRozsahu;
              const mimo = b.datum < pravidla.min || b.datum > pravidla.max;
              return (
                <Pressable
                  key={b.datum}
                  style={styles.dayCell}
                  disabled={mimo && !b.vybrany}
                  onPress={() => onDen(b.datum)}
                >
                  <View
                    style={[
                      styles.dayInner,
                      volny && styles.dayVolny,
                      b.obsadeny && styles.dayObsadeny,
                      (b.vybrany || jeZaciatok) && styles.dayVybrany,
                      jeZaciatok && styles.dayZaciatok,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        volny && styles.dayTextVolny,
                        b.obsadeny && styles.dayTextObsadeny,
                        !b.volitelny && !b.vybrany && styles.dayTextDisabled,
                        (b.vybrany || jeZaciatok) && styles.dayTextSelected,
                      ]}
                    >
                      {b.den}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: VIKEND_POZADIE }]} />
            <Text style={styles.legend}>{t.legendaVikend}</Text>
            {pravidla.obsadene.size > 0 ? (
              <>
                <View style={[styles.legendDot, styles.legendObsadene]} />
                <Text style={styles.legend}>{t.legendaObsazeno}</Text>
              </>
            ) : null}
          </View>

          <View style={styles.toolRow}>
            <Pressable
              style={[styles.toolBtn, rezimRozsahu && styles.toolBtnActive]}
              onPress={() => {
                setRezimRozsahu((r) => !r);
                setZaciatokRozsahu(null);
                setHint(null);
              }}
            >
              <Text style={[styles.toolText, rezimRozsahu && styles.toolTextActive]}>
                {rezimRozsahu ? t.rozsahZrusit : t.vybratRozsah}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.toolBtn, !draft.length && styles.navBtnDisabled]}
              disabled={!draft.length}
              onPress={() => {
                setDraft([]);
                setHint(null);
              }}
            >
              <Text style={styles.toolText}>{t.vymazat}</Text>
            </Pressable>
          </View>

          <Text style={styles.summary}>
            {draft.length ? t.vybrano(draft.length) : t.nicNevybrano}
          </Text>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}

          <View style={styles.btnRow}>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>{cs.spolecne.zrusit}</Text>
            </Pressable>
            <Pressable
              style={styles.okBtn}
              onPress={() => {
                onConfirm(draft);
                onClose();
              }}
            >
              <Text style={styles.okText}>{cs.spolecne.potvrdit}</Text>
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
  title: { fontSize: font.lg, fontWeight: "800", color: colors.text, textAlign: "center" },
  help: { fontSize: font.sm, color: colors.muted, textAlign: "center" },
  navRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  navBtnDisabled: { opacity: 0.35 },
  navBtnText: { fontSize: font.xl, fontWeight: "700", color: colors.primary, lineHeight: 24 },
  monthLabel: { fontSize: font.md, fontWeight: "700", color: colors.text },
  weekRow: { flexDirection: "row", marginTop: spacing.xs },
  weekday: { flex: 1, textAlign: "center", fontSize: font.xs, fontWeight: "700", color: colors.muted },
  weekdayVikend: { color: colors.danger },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2 },
  dayInner: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 999 },
  dayVolny: { backgroundColor: VIKEND_POZADIE },
  dayObsadeny: { backgroundColor: OBSADENE_POZADIE, borderWidth: 1.5, borderColor: OBSADENE },
  dayVybrany: { backgroundColor: colors.primary, borderWidth: 0 },
  dayZaciatok: { backgroundColor: colors.primaryMuted },
  dayText: { fontSize: font.md, fontWeight: "600", color: colors.text },
  dayTextVolny: { color: colors.danger },
  dayTextObsadeny: { color: OBSADENE, textDecorationLine: "line-through" },
  dayTextDisabled: { opacity: 0.35 },
  dayTextSelected: { color: colors.primaryText, fontWeight: "800", textDecorationLine: "none" },
  legendRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendObsadene: { backgroundColor: OBSADENE_POZADIE, borderWidth: 1.5, borderColor: OBSADENE },
  legend: { fontSize: font.xs, color: colors.muted, marginRight: spacing.sm },
  toolRow: { flexDirection: "row", gap: spacing.sm },
  toolBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: "center",
  },
  toolBtnActive: { backgroundColor: colors.primary },
  toolText: { fontSize: font.sm, fontWeight: "700", color: colors.primary },
  toolTextActive: { color: colors.primaryText },
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
  okText: { fontSize: font.md, fontWeight: "700", color: colors.primaryText },
});
