import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { FormScrollView } from "../../components/FormScrollView";
import { VyberDniKalendarModal } from "../../components/VyberDniKalendarModal";
import { usePragueToday } from "../../hooks/useDochadzka";
import {
  CHYBA_BEZ_NADRIADENEHO,
  useMojeOpravnenia,
  useMojeZiadosti,
  useVytvorZiadost,
} from "../../hooks/useDochadzkaZiadosti";
import { cs } from "../../i18n/cs";
import { formatDenKratce } from "../../i18n/datum";
import { colors, font, spacing } from "../../theme";
import {
  AUTO_SCHVALENE_DRUHY,
  CAST_DNA,
  CAST_DNA_LABEL,
  DEFAULT_DENNY_FOND_HOD,
  formatCasHHMM,
  formatHodiny,
  hodinyDovolenky,
  jeStatnySviatokCR,
  jeVikend,
  lenPracovneDniDruhu,
  obsadeneDni,
  parseCasHHMM,
  popisVybranychDni,
  povolenyRozsah,
  PREDVOLENY_CAS_DO,
  PREDVOLENY_CAS_OD,
  SPATNY_ZAPIS_MAX_DNI,
  ZIADOST_DOPREDU_MAX_DNI,
  ZIADOST_DRUH_LABEL,
  ZIADOST_DRUHY,
  type CastDna,
  type DenCasu,
  type DenNahradnehoVolna,
  type NovaZiadostVstup,
  type ZiadostDruh,
} from "../../utils/dochadzkaZiadosti";
import type { PravidlaVyberu } from "../../utils/vyberDni";
import type { DochadzkaStackParamList } from "./DochadzkaNavigator";
import { ui } from "./dochadzkaUi";

type Props = NativeStackScreenProps<DochadzkaStackParamList, "DochadzkaNovaZiadost">;

type CasyDna = { od: string; do: string };
type NvDna = { celyDen: boolean; hodiny: string };

const T = cs.zadosti.nova;
const PREDVOLENE_CASY: CasyDna = {
  od: formatCasHHMM(PREDVOLENY_CAS_OD),
  do: formatCasHHMM(PREDVOLENY_CAS_DO),
};
const PREDVOLENE_NV: NvDna = { celyDen: true, hodiny: "" };

function popisDruhu(d: ZiadostDruh): string {
  if (d === "SluzobnaCesta" || d === "HomeOffice") {
    return T.popisAuto(SPATNY_ZAPIS_MAX_DNI, ZIADOST_DOPREDU_MAX_DNI);
  }
  if (d === "SpatnaPritomnost") return T.popisZpetna(SPATNY_ZAPIS_MAX_DNI);
  return T.popisNadrizeny;
}

function poznamkaDna(datum: string): string {
  if (jeStatnySviatokCR(datum)) return T.svatek;
  if (jeVikend(datum)) return T.vikend;
  return "";
}

function parseHodiny(text: string): number {
  return Number(text.trim().replace(",", "."));
}

export function NovaZiadostScreen({ navigation }: Props) {
  const dnes = usePragueToday();
  const opravnenia = useMojeOpravnenia();
  const mojeZiadosti = useMojeZiadosti();
  const vytvor = useVytvorZiadost();
  const fond = opravnenia.data?.dennyFondHod ?? DEFAULT_DENNY_FOND_HOD;
  const bezNadriadeneho = !!opravnenia.data && !opravnenia.data.nadriadenyEmail;

  const [druh, setDruh] = useState<ZiadostDruh | null>(null);
  const [vybrane, setVybrane] = useState<string[]>([]);
  const [casy, setCasy] = useState<Record<string, CasyDna>>({});
  const [spolocnyCas, setSpolocnyCas] = useState(false);
  const [spolocne, setSpolocne] = useState<CasyDna>(PREDVOLENE_CASY);
  const [castiDna, setCastiDna] = useState<Record<string, CastDna>>({});
  const [nv, setNv] = useState<Record<string, NvDna>>({});
  const [poznamka, setPoznamka] = useState("");
  const [dovod, setDovod] = useState("");
  const [kalendarOpen, setKalendarOpen] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [hotovo, setHotovo] = useState<{ title: string; message: string } | null>(null);

  const sCasom = druh === "SluzobnaCesta" || druh === "HomeOffice";

  const vyberDruh = (d: ZiadostDruh) => {
    setDruh(d);
    setVybrane([]);
    setCasy({});
    setSpolocnyCas(false);
    setSpolocne(PREDVOLENE_CASY);
    setCastiDna({});
    setNv({});
    setPoznamka("");
    setDovod("");
    setChyba(null);
    vytvor.reset();
  };

  useEffect(
    () => setChyba(null),
    [vybrane, casy, spolocnyCas, spolocne, castiDna, nv, poznamka, dovod],
  );

  const obsadene = useMemo(() => obsadeneDni(mojeZiadosti.data ?? []), [mojeZiadosti.data]);

  const pravidla = useMemo<PravidlaVyberu | null>(() => {
    if (!druh) return null;
    return {
      ...povolenyRozsah(druh, dnes),
      obsadene,
      lenPracovne: lenPracovneDniDruhu(druh),
      rozsahLenPracovne: druh === "HomeOffice",
    };
  }, [druh, dnes, obsadene]);

  const casDna = (d: string): CasyDna => casy[d] ?? PREDVOLENE_CASY;
  const castDna = (d: string): CastDna => castiDna[d] ?? "Cely";
  const nvDna = (d: string): NvDna => nv[d] ?? PREDVOLENE_NV;

  const upravCas = (d: string, zmena: Partial<CasyDna>) =>
    setCasy((prev) => ({ ...prev, [d]: { ...(prev[d] ?? PREDVOLENE_CASY), ...zmena } }));
  const upravNv = (d: string, zmena: Partial<NvDna>) =>
    setNv((prev) => ({ ...prev, [d]: { ...(prev[d] ?? PREDVOLENE_NV), ...zmena } }));
  const odober = (d: string) => setVybrane((prev) => prev.filter((x) => x !== d));

  const zapniSpolocnyCas = (v: boolean) => {
    if (v && vybrane[0]) setSpolocne(casDna(vybrane[0]));
    setSpolocnyCas(v);
  };

  const hodinyDovolenkySpolu = useMemo(
    () =>
      druh === "Dovolenka"
        ? hodinyDovolenky(
            vybrane.map((d) => ({ datum: d, castDna: castiDna[d] ?? "Cely" })),
            fond,
          )
        : 0,
    [castiDna, druh, fond, vybrane],
  );

  const zostavCasy = (): DenCasu[] | string => {
    const out: DenCasu[] = [];
    for (const d of vybrane) {
      const c = sCasom && spolocnyCas ? spolocne : casDna(d);
      const a = parseCasHHMM(c.od);
      const b = parseCasHHMM(c.do);
      if (a === null || b === null) return cs.zadosti.chyby.neplatnyCas(formatDenKratce(d));
      out.push({ datum: d, odMin: a, doMin: b });
    }
    return out;
  };

  const zostavVstup = (): NovaZiadostVstup | string => {
    if (!vybrane.length) return cs.zadosti.chyby.vyberteDen;
    switch (druh) {
      case "SluzobnaCesta":
      case "HomeOffice":
      case "SpatnaPritomnost": {
        const dni = zostavCasy();
        if (typeof dni === "string") return dni;
        if (druh === "SluzobnaCesta") return { druh, dni, poznamka };
        if (druh === "HomeOffice") return { druh, dni };
        return { druh, dni, dovod };
      }
      case "Dovolenka":
        return { druh, dni: vybrane.map((d) => ({ datum: d, castDna: castDna(d) })) };
      case "NahradneVolno": {
        const dni: DenNahradnehoVolna[] = [];
        for (const d of vybrane) {
          const v = nvDna(d);
          const h = parseHodiny(v.hodiny);
          if (!v.celyDen && !(h > 0)) return T.zadejteHodiny(formatDenKratce(d));
          dni.push({ datum: d, celyDen: v.celyDen, hodiny: v.celyDen ? fond : h });
        }
        return { druh, dni };
      }
      default:
        return T.vyberteDruh;
    }
  };

  const odoslat = () => {
    if (bezNadriadeneho) {
      setChyba(CHYBA_BEZ_NADRIADENEHO);
      return;
    }
    const vstup = zostavVstup();
    if (typeof vstup === "string") {
      setChyba(vstup);
      return;
    }
    vytvor.mutate(
      { vstup, dnes },
      {
        onSuccess: () => {
          const auto = AUTO_SCHVALENE_DRUHY.has(vstup.druh);
          setHotovo({
            title: auto ? T.zapsanoTitulek : T.odeslanoTitulek,
            message: auto ? T.zapsanoText(ZIADOST_DRUH_LABEL[vstup.druh]) : T.odeslanoText,
          });
        },
      },
    );
  };

  const vyberDniPole = (
    <Pole label={T.dny}>
      <Pressable style={styles.picker} onPress={() => setKalendarOpen(true)}>
        <Text style={[styles.pickerText, !vybrane.length && styles.pickerPlaceholder]}>
          {vybrane.length ? popisVybranychDni(vybrane) : T.vyberteDny}
        </Text>
        <Text style={styles.link}>
          {vybrane.length ? cs.kalendar.zmenitDny : cs.kalendar.vybratDny}
        </Text>
      </Pressable>
    </Pole>
  );

  const casInputy = (c: CasyDna, onChange: (z: Partial<CasyDna>) => void) => (
    <>
      <TextInput
        style={styles.casInput}
        value={c.od}
        onChangeText={(t) => onChange({ od: t })}
        keyboardType="numbers-and-punctuation"
        selectTextOnFocus
      />
      <Text style={ui.cardMeta}>–</Text>
      <TextInput
        style={styles.casInput}
        value={c.do}
        onChangeText={(t) => onChange({ do: t })}
        keyboardType="numbers-and-punctuation"
        selectTextOnFocus
      />
    </>
  );

  const denHlavicka = (d: string) => (
    <View style={{ flex: 1 }}>
      <Text style={styles.denText}>{formatDenKratce(d)}</Text>
      {poznamkaDna(d) ? <Text style={ui.cardMeta}>{poznamkaDna(d)}</Text> : null}
    </View>
  );

  const odobratTlacidlo = (d: string) => (
    <Pressable
      style={styles.odobrat}
      onPress={() => odober(d)}
      accessibilityLabel={T.odebratDen}
      hitSlop={8}
    >
      <Text style={styles.odobratText}>✕</Text>
    </Pressable>
  );

  let formular: React.ReactNode = null;
  if (druh === "SluzobnaCesta" || druh === "HomeOffice") {
    formular = (
      <>
        {vyberDniPole}
        {druh === "SluzobnaCesta" ? (
          <Pole label={T.poznamkaNepovinna}>
            <TextInput
              style={styles.input}
              value={poznamka}
              onChangeText={setPoznamka}
              placeholderTextColor={colors.muted}
            />
          </Pole>
        ) : null}
        {vybrane.length ? (
          <>
            <View style={styles.rowBetween}>
              <Text style={ui.cardTitle}>{T.casPoDnech}</Text>
              {vybrane.length > 1 ? (
                <View style={styles.inlineSwitch}>
                  <Text style={ui.cardMeta}>{T.stejnyCas}</Text>
                  <Switch
                    value={spolocnyCas}
                    onValueChange={zapniSpolocnyCas}
                    trackColor={{ true: colors.primaryMuted, false: colors.border }}
                  />
                </View>
              ) : null}
            </View>
            {spolocnyCas ? (
              <View style={styles.denRow}>
                <Text style={[styles.denText, { flex: 1 }]}>{T.vsechnyDny}</Text>
                {casInputy(spolocne, (z) => setSpolocne((p) => ({ ...p, ...z })))}
              </View>
            ) : null}
            {vybrane.map((d) => (
              <View key={d} style={styles.denRow}>
                {denHlavicka(d)}
                {spolocnyCas ? null : casInputy(casDna(d), (z) => upravCas(d, z))}
                {odobratTlacidlo(d)}
              </View>
            ))}
          </>
        ) : null}
      </>
    );
  } else if (druh === "SpatnaPritomnost") {
    formular = (
      <>
        {vyberDniPole}
        {vybrane.length ? (
          <>
            <View style={styles.rowBetween}>
              <Text style={ui.cardTitle}>{T.prichodOdchod}</Text>
            </View>
            {vybrane.map((d) => (
              <View key={d} style={styles.denRow}>
                {denHlavicka(d)}
                {casInputy(casDna(d), (z) => upravCas(d, z))}
                {odobratTlacidlo(d)}
              </View>
            ))}
          </>
        ) : null}
        <Pole label={T.duvod}>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={dovod}
            onChangeText={setDovod}
            placeholder={T.duvodPlaceholder}
            placeholderTextColor={colors.muted}
            multiline
          />
        </Pole>
      </>
    );
  } else if (druh === "Dovolenka") {
    formular = (
      <>
        {vyberDniPole}
        {vybrane.map((d) => (
          <View key={d} style={[styles.denRow, styles.denRowWrap]}>
            <View style={styles.denRowTop}>
              {denHlavicka(d)}
              {odobratTlacidlo(d)}
            </View>
            <View style={styles.chips}>
              {CAST_DNA.map((c) => (
                <Pressable
                  key={c}
                  style={[styles.chip, castDna(d) === c && styles.chipOn]}
                  onPress={() => setCastiDna((prev) => ({ ...prev, [d]: c }))}
                >
                  <Text style={[styles.chipText, castDna(d) === c && styles.chipTextOn]}>
                    {CAST_DNA_LABEL[c]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
        <Text style={ui.cardMeta}>
          {vybrane.length
            ? T.dovolenaSouhrn(vybrane.length, formatHodiny(hodinyDovolenkySpolu))
            : null}
          {vybrane.length ? " " : null}
          {T.dovolenaPozn}
        </Text>
      </>
    );
  } else if (druh === "NahradneVolno") {
    formular = (
      <>
        {vyberDniPole}
        {vybrane.map((d) => {
          const v = nvDna(d);
          return (
            <View key={d} style={[styles.denRow, styles.denRowWrap]}>
              <View style={styles.denRowTop}>
                {denHlavicka(d)}
                {odobratTlacidlo(d)}
              </View>
              <View style={styles.rowBetweenTight}>
                <Text style={ui.cardMeta}>{T.celyDen(formatHodiny(fond))}</Text>
                <Switch
                  value={v.celyDen}
                  onValueChange={(c) => upravNv(d, { celyDen: c })}
                  trackColor={{ true: colors.primaryMuted, false: colors.border }}
                />
              </View>
              {!v.celyDen ? (
                <View style={styles.rowBetweenTight}>
                  <Text style={ui.cardMeta}>{T.pocetHodin}</Text>
                  <TextInput
                    style={styles.casInput}
                    value={v.hodiny}
                    onChangeText={(t) => upravNv(d, { hodiny: t })}
                    keyboardType="decimal-pad"
                    placeholder={T.hodinyPlaceholder}
                    placeholderTextColor={colors.muted}
                  />
                </View>
              ) : null}
            </View>
          );
        })}
      </>
    );
  }

  const zobrazChyba = chyba ?? (vytvor.error instanceof Error ? vytvor.error.message : null);

  return (
    <SafeAreaView style={ui.safe} edges={["top", "left", "right"]}>
      <FormScrollView contentContainerStyle={ui.scroll}>
        <View style={ui.topBar}>
          <Pressable
            style={ui.backBtn}
            onPress={() => (druh ? setDruh(null) : navigation.goBack())}
          >
            <Text style={ui.backBtnText}>{cs.spolecne.zpet}</Text>
          </Pressable>
          <Text style={ui.topBarTitle}>{druh ? ZIADOST_DRUH_LABEL[druh] : T.titulek}</Text>
          <View style={ui.backBtnPlaceholder} />
        </View>

        {opravnenia.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {bezNadriadeneho ? (
          <View style={ui.card}>
            <Text style={[ui.cardTitle, { color: colors.danger }]}>{CHYBA_BEZ_NADRIADENEHO}</Text>
            <Text style={ui.muted}>{T.nelzeOdeslat}</Text>
          </View>
        ) : null}

        {!druh ? (
          ZIADOST_DRUHY.map((d) => (
            <Pressable key={d} style={ui.card} onPress={() => vyberDruh(d)}>
              <Text style={ui.cardTitle}>{ZIADOST_DRUH_LABEL[d]}</Text>
              <Text style={ui.cardMeta}>{popisDruhu(d)}</Text>
            </Pressable>
          ))
        ) : (
          <>
            {formular}
            {zobrazChyba ? (
              <Text style={ui.error} selectable>
                {zobrazChyba}
              </Text>
            ) : null}
            <Pressable
              style={[
                ui.primaryBtn,
                { marginTop: spacing.md },
                (vytvor.isPending || bezNadriadeneho) && ui.disabled,
              ]}
              disabled={vytvor.isPending || bezNadriadeneho}
              onPress={odoslat}
            >
              {vytvor.isPending ? (
                <ActivityIndicator color={colors.primaryText} />
              ) : (
                <Text style={ui.primaryBtnText}>
                  {AUTO_SCHVALENE_DRUHY.has(druh) ? T.zapsat : T.odeslatKeSchvaleni}
                </Text>
              )}
            </Pressable>
          </>
        )}
      </FormScrollView>

      <ConfirmDialog
        visible={!!hotovo}
        hideCancel
        title={hotovo?.title ?? ""}
        message={hotovo?.message}
        confirmLabel={cs.spolecne.ok}
        onConfirm={() => {
          setHotovo(null);
          navigation.goBack();
        }}
        onClose={() => {
          setHotovo(null);
          navigation.goBack();
        }}
      />

      {druh && pravidla ? (
        <VyberDniKalendarModal
          visible={kalendarOpen}
          vybrane={vybrane}
          pravidla={pravidla}
          vychodziDen={dnes}
          title={ZIADOST_DRUH_LABEL[druh]}
          onConfirm={setVybrane}
          onClose={() => setKalendarOpen(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}

function Pole({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={ui.cardMeta}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  picker: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  pickerText: { flex: 1, fontSize: font.md, fontWeight: "700", color: colors.text },
  pickerPlaceholder: { color: colors.muted, fontWeight: "600" },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    fontSize: font.md,
    color: colors.text,
  },
  multiline: { minHeight: 80, textAlignVertical: "top", paddingTop: spacing.sm },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  rowBetweenTight: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  inlineSwitch: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flexShrink: 1 },
  link: { fontSize: font.sm, fontWeight: "700", color: colors.primary },
  denRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  denRowWrap: { flexDirection: "column", alignItems: "stretch", gap: spacing.xs },
  denRowTop: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  denText: { fontSize: font.md, fontWeight: "700", color: colors.text },
  casInput: {
    width: 64,
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    textAlign: "center",
    fontSize: font.md,
    color: colors.text,
    paddingVertical: 4,
  },
  odobrat: { paddingHorizontal: spacing.xs, paddingVertical: 4 },
  odobratText: { fontSize: font.md, fontWeight: "800", color: colors.muted },
  chips: { flexDirection: "row", gap: spacing.xs, flexWrap: "wrap" },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  chipOn: { backgroundColor: colors.primary },
  chipText: { fontSize: font.sm, fontWeight: "700", color: colors.primary },
  chipTextOn: { color: colors.primaryText },
});
