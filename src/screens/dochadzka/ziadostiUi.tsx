import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { cs } from "../../i18n/cs";
import { colors, font, spacing } from "../../theme";
import {
  CAST_DNA_LABEL,
  formatHodiny,
  popisDnaZiadosti,
  popisTerminu,
  ziadostDruhLabel,
  ziadostStavLabel,
  type CastDna,
  type ZiadostSkupina,
} from "../../utils/dochadzkaZiadosti";
import { ui } from "./dochadzkaUi";

const T = cs.zadosti.seznam;

const STAV_FARBA: Record<string, { fg: string; bg: string }> = {
  Ziadost: { fg: "#9A5B00", bg: "#FFF3DC" },
  Schvalene: { fg: colors.success, bg: "#E7F6EE" },
  Zamietnute: { fg: colors.danger, bg: "#FDECEA" },
  Zrusene: { fg: colors.muted, bg: "#EEF0EF" },
};

export function StavBadge({ stav }: { stav: string }) {
  const f = STAV_FARBA[stav] ?? STAV_FARBA.Zrusene;
  return (
    <Text style={[styles.badge, { color: f.fg, backgroundColor: f.bg }]}>
      {ziadostStavLabel(stav)}
    </Text>
  );
}

/** Hlavička skupiny žiadosti: druh, stav, konkrétne dni, hodiny, poznámka, dôvod zamietnutia. */
export function SkupinaPopis({
  s,
  meno,
  children,
}: {
  s: ZiadostSkupina;
  meno?: string;
  children?: React.ReactNode;
}) {
  const viacDni = s.polozky.length > 1;
  const castPrvehoDna = s.polozky[0]?.castDna;
  return (
    <View style={ui.card}>
      <View style={styles.head}>
        <Text style={[ui.cardTitle, { flex: 1 }]}>{ziadostDruhLabel(s.druh)}</Text>
        <StavBadge stav={s.stav} />
      </View>
      {meno ? <Text style={ui.cardMeta}>{meno}</Text> : null}
      <Text style={styles.termin}>{popisTerminu(s)}</Text>
      {viacDni ? (
        <View style={styles.dni}>
          {s.polozky.map((p) => (
            <Text
              key={p.id}
              style={[styles.den, p.stav !== s.stav && p.stav === "Zrusene" && styles.denZruseny]}
            >
              {popisDnaZiadosti(p)}
              {p.stav !== s.stav ? ` · ${ziadostStavLabel(p.stav).toLowerCase()}` : ""}
            </Text>
          ))}
        </View>
      ) : castPrvehoDna === "Dopoludnie" || castPrvehoDna === "Popoludnie" ? (
        <Text style={ui.cardMeta}>{CAST_DNA_LABEL[castPrvehoDna as CastDna]}</Text>
      ) : null}
      {s.hodiny > 0 ? <Text style={ui.cardMeta}>{T.celkem(formatHodiny(s.hodiny))}</Text> : null}
      {s.poznamka ? (
        <Text style={ui.muted}>
          {s.druh === "SpatnaPritomnost" ? T.duvod : T.poznamka}
          {s.poznamka}
        </Text>
      ) : null}
      {s.dovodZamietnutia ? (
        <Text style={ui.error}>
          {T.zamitnuto}
          {s.dovodZamietnutia}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  termin: { fontSize: font.md, fontWeight: "700", color: colors.text },
  dni: { gap: 2 },
  den: { fontSize: font.sm, color: colors.text },
  denZruseny: { color: colors.muted, textDecorationLine: "line-through" },
  badge: {
    fontSize: font.xs,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: "hidden",
  },
});
