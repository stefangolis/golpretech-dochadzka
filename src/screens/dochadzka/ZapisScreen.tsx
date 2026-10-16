import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { useIsFocused } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../../auth/AuthContext";
import {
  useDochadzkaDnes,
  useOverNfcTag,
  usePoslednyZapis,
  useZapisBezNalepky,
  useZapisUdalost,
} from "../../hooks/useDochadzka";
import { cs } from "../../i18n/cs";
import { colors, font, spacing } from "../../theme";
import {
  isoNaSekundy,
  pragueTimeLabel,
  typLabel,
  type DochadzkaTyp,
} from "../../utils/dochadzkaVypocet";
import { AUTO_POTVRDENIE_MS, relevantneTypy } from "../../utils/dochadzkaZapis";
import { normalizeTagUid } from "../../utils/nfc";
import { signalNfcOverenia } from "../../utils/nfcSignal";
import {
  POLOHA_NEDOSTUPNA,
  POLOHA_NEPOVOLENE,
  zistiPolohuJednorazovo,
} from "../../utils/poloha";
import type { DochadzkaStackParamList } from "./DochadzkaNavigator";
import { ui, useClock } from "./dochadzkaUi";

type Props = NativeStackScreenProps<DochadzkaStackParamList, "DochadzkaZapis">;

const OPAKOVANE_TUKNUTIE_MS = 60_000;

/** caka = čaká na overenie nálepky a načítanie dnešných udalostí. */
type Odpocet = "caka" | "bezi" | "zastaveny";

const T = cs.dochazka.zapis;

function potvrdenieText(typ: DochadzkaTyp, cas: string, voFronte: boolean): string {
  const zapisany = typ === "FajciarskaPrestavka" ? T.zapsana : T.zapsan;
  const base = `${typLabel(typ)} ${pragueTimeLabel(cas)} ${zapisany}`;
  return voFronte ? `${base}${T.bezPripojeni}` : base;
}

function polohaPopis(p: string | null): string {
  if (p === null) return T.polohaZjistuji;
  if (p === POLOHA_NEPOVOLENE) return T.polohaNepovolena;
  if (p === POLOHA_NEDOSTUPNA) return T.polohaNedostupna;
  const presnost = p.split(",")[2];
  return presnost ? T.polohaZjistenaPresnost(presnost) : T.polohaZjistena;
}

export function ZapisScreen({ navigation, route }: Props) {
  const params = route.params;
  const jeNfc = params.zdroj === "NFC";
  const tagUid = jeNfc ? normalizeTagUid(params.tagUid) : null;
  const casTuknutia = jeNfc ? params.casTuknutia : null;

  const { user } = useAuth();
  const now = useClock(1000);
  const isFocused = useIsFocused();
  const { udalosti, server } = useDochadzkaDnes();
  const tag = useOverNfcTag(tagUid, casTuknutia);
  const posledny = usePoslednyZapis();
  const bezNalepky = useZapisBezNalepky();
  const zapis = useZapisUdalost();
  const [vybranyTyp, setVybranyTyp] = useState<DochadzkaTyp | null>(null);
  const [odpocet, setOdpocet] = useState<Odpocet>(jeNfc ? "caka" : "zastaveny");
  const [termin, setTermin] = useState<number | null>(null);
  const [zostavaMs, setZostavaMs] = useState(AUTO_POTVRDENIE_MS);
  const [poloha, setPoloha] = useState<string | null>(null);
  const polohaPromise = useRef<Promise<string> | null>(null);
  const [cakamNaPolohu, setCakamNaPolohu] = useState(false);
  const busy = cakamNaPolohu || zapis.isPending;
  const [uidSkopirovane, setUidSkopirovane] = useState(false);

  useEffect(() => {
    setUidSkopirovane(false);
    setVybranyTyp(null);
    setTermin(null);
    setOdpocet(jeNfc ? "caka" : "zastaveny");
  }, [casTuknutia, jeNfc, tagUid]);

  const kopirujUid = async () => {
    if (!tagUid) return;
    await Clipboard.setStringAsync(tagUid);
    setUidSkopirovane(true);
  };

  useEffect(() => {
    if (jeNfc || polohaPromise.current) return;
    polohaPromise.current = zistiPolohuJednorazovo();
    void polohaPromise.current.then(setPoloha);
  }, [jeNfc]);

  const relevantne = useMemo(() => relevantneTypy(udalosti), [udalosti]);
  const typ =
    vybranyTyp && relevantne.typy.includes(vybranyTyp) ? vybranyTyp : relevantne.navrh;

  /** Opätovné ťuknutie do 60 s po zápise — len ukáž posledný záznam. */
  const nedavnyZapis = useMemo(() => {
    const z = posledny.data;
    if (!jeNfc || !z || !casTuknutia) return null;
    const diff = Date.parse(casTuknutia) - z.zapisaneAt;
    return diff >= 0 && diff < OPAKOVANE_TUKNUTIE_MS ? z : null;
  }, [casTuknutia, jeNfc, posledny.data]);

  const overujem = jeNfc && (tag.isLoading || (tag.isFetching && !tag.data) || posledny.isLoading);

  const overenySignal = useRef<string | null>(null);
  useEffect(() => {
    if (!jeNfc || !casTuknutia || overujem || tag.isError) return;
    if (overenySignal.current === casTuknutia) return;
    overenySignal.current = casTuknutia;
    signalNfcOverenia({ maPristup: true, tagZnamy: !!tag.data });
  }, [casTuknutia, jeNfc, overujem, tag.data, tag.isError]);

  const potvrd = async (t: DochadzkaTyp) => {
    if (busy) return;
    setOdpocet("zastaveny");
    const cas = casTuknutia ?? isoNaSekundy();
    let polohaHodnota: string | null = null;
    if (!jeNfc) {
      setCakamNaPolohu(true);
      try {
        polohaHodnota = await (polohaPromise.current ?? zistiPolohuJednorazovo());
      } finally {
        setCakamNaPolohu(false);
      }
    }
    zapis.mutate(
      {
        typ: t,
        cas,
        zdroj: jeNfc ? "NFC" : "Mobil",
        tagId: tagUid,
        poloha: polohaHodnota,
      },
      {
        onSuccess: (r) => {
          navigation.popTo("DochadzkaDnes", {
            potvrdenie: potvrdenieText(r.typ, r.cas, r.voFronte),
          });
        },
      },
    );
  };

  const potvrdRef = useRef(potvrd);
  potvrdRef.current = potvrd;
  const typRef = useRef(typ);
  typRef.current = typ;

  const pripravene =
    jeNfc &&
    !overujem &&
    !!tag.data &&
    !nedavnyZapis &&
    !server.isLoading &&
    !zapis.isPending &&
    !zapis.isError;

  useEffect(() => {
    if (odpocet === "caka" && pripravene && isFocused && AppState.currentState === "active") {
      setTermin(Date.now() + AUTO_POTVRDENIE_MS);
      setZostavaMs(AUTO_POTVRDENIE_MS);
      setOdpocet("bezi");
    }
  }, [isFocused, odpocet, pripravene]);

  useEffect(() => {
    if (odpocet === "bezi" && (!isFocused || !pripravene)) setOdpocet("zastaveny");
  }, [isFocused, odpocet, pripravene]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") setOdpocet((o) => (o === "bezi" ? "zastaveny" : o));
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (odpocet !== "bezi" || termin === null) return;
    const tick = () => {
      const zostava = termin - Date.now();
      if (zostava <= 0) {
        setOdpocet("zastaveny");
        void potvrdRef.current(typRef.current);
      } else {
        setZostavaMs(zostava);
      }
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [odpocet, termin]);

  const vyberTyp = (t: DochadzkaTyp) => {
    setOdpocet("zastaveny");
    setVybranyTyp(t);
  };

  const zrusit = () => {
    setOdpocet("zastaveny");
    navigation.popTo("DochadzkaDnes");
  };

  const header = (
    <View style={styles.header}>
      <Text style={styles.name} numberOfLines={1}>
        {user?.displayName}
      </Text>
      <Text style={styles.clock}>{pragueTimeLabel(now)}</Text>
      {jeNfc ? (
        <Text style={ui.cardMeta}>
          {T.nalepka}
          {tag.data ? `: ${tag.data.umiestnenie || tag.data.nazov || T.overena}` : ""}
          {casTuknutia ? T.prilozenaV(pragueTimeLabel(casTuknutia)) : ""}
        </Text>
      ) : (
        <Text style={ui.cardMeta}>{T.bezNalepkyPoloha(polohaPopis(poloha))}</Text>
      )}
    </View>
  );

  let body: React.ReactNode;

  if (overujem) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={ui.muted}>{T.overujiNalepku}</Text>
      </View>
    );
  } else if (jeNfc && tag.error) {
    body = (
      <View style={ui.card}>
        <Text style={ui.cardTitle}>{T.nalepkuNelzeOverit}</Text>
        <Text style={ui.error} selectable>
          {tag.error instanceof Error ? tag.error.message : String(tag.error)}
        </Text>
        <Text style={ui.muted}>{T.nalepkaOfflineText}</Text>
        <Pressable style={ui.secondaryBtn} onPress={() => void tag.refetch()}>
          <Text style={ui.secondaryBtnText}>{cs.spolecne.zkusitZnovu}</Text>
        </Pressable>
      </View>
    );
  } else if (jeNfc && !tag.data) {
    body = (
      <View style={ui.card}>
        <Text style={[ui.cardTitle, { color: colors.danger, fontSize: font.xl }]}>
          {T.neznamyTag}
        </Text>
        <Text style={ui.muted}>{T.neznamyTagText}</Text>
        <Text style={ui.cardMeta}>{T.uidNalepky}</Text>
        <Text style={styles.uid} selectable>
          {tagUid}
        </Text>
        <Pressable style={ui.secondaryBtn} onPress={() => void kopirujUid()}>
          <Text style={ui.secondaryBtnText}>
            {uidSkopirovane ? T.zkopirovano : T.kopirovatUid}
          </Text>
        </Pressable>
        <Pressable style={ui.secondaryBtn} onPress={() => void tag.refetch()}>
          <Text style={ui.secondaryBtnText}>{T.zkontrolovatZnovu}</Text>
        </Pressable>
      </View>
    );
  } else if (!jeNfc && bezNalepky.isLoading) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  } else if (!jeNfc && !bezNalepky.data) {
    body = (
      <View style={ui.card}>
        <Text style={ui.cardTitle}>{T.bezNalepkyNepovoleno}</Text>
        <Text style={ui.muted}>{T.prilozTelefon}</Text>
      </View>
    );
  } else if (nedavnyZapis) {
    body = (
      <View style={ui.successBox}>
        <Text style={ui.successText}>
          {T.uzZapsano(typLabel(nedavnyZapis.typ), pragueTimeLabel(nedavnyZapis.cas))}
        </Text>
        <Text style={ui.muted}>{T.opakovanePrilozeni}</Text>
      </View>
    );
  } else {
    const bezi = odpocet === "bezi";
    body = (
      <View style={{ gap: spacing.sm }}>
        <Pressable
          style={[styles.bigBtn, busy && ui.disabled]}
          disabled={busy}
          onPress={() => void potvrd(typ)}
        >
          {busy ? (
            <ActivityIndicator color={colors.primaryText} size="large" />
          ) : (
            <>
              <Text style={styles.bigBtnLabel}>{bezi ? T.potvrditTed : cs.spolecne.potvrdit}</Text>
              <Text style={styles.bigBtnTyp}>
                {typLabel(typ)}
                {relevantne.stav === "prec" && typ === "Prichod" ? T.navrat : ""}
              </Text>
            </>
          )}
        </Pressable>
        {bezi ? (
          <Text style={styles.odpocet}>
            {T.ulozi(Math.max(1, Math.ceil(zostavaMs / 1000)))}
          </Text>
        ) : null}

        {zapis.error ? (
          <Text style={ui.error} selectable>
            {zapis.error instanceof Error ? zapis.error.message : String(zapis.error)}
          </Text>
        ) : null}

        {relevantne.typy.length > 1 ? (
          <>
            <Text style={ui.cardMeta}>{T.jinaUdalost}</Text>
            <View style={styles.grid}>
              {relevantne.typy.map((t) => (
                <TypBtn key={t} typ={t} vybrany={t === typ} busy={busy} onPress={vyberTyp} />
              ))}
            </View>
          </>
        ) : null}
      </View>
    );
  }

  return (
    <SafeAreaView style={ui.safe} edges={["top", "left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={ui.scroll}>
        {header}
        {body}
        <Pressable
          style={[ui.secondaryBtn, { marginTop: spacing.md }]}
          disabled={busy}
          onPress={zrusit}
        >
          <Text style={ui.secondaryBtnText}>
            {nedavnyZapis || (jeNfc && !overujem && !tag.data) ? T.zpet : cs.spolecne.zrusit}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function TypBtn({
  typ,
  vybrany,
  busy,
  onPress,
}: {
  typ: DochadzkaTyp;
  vybrany: boolean;
  busy: boolean;
  onPress: (t: DochadzkaTyp) => void;
}) {
  return (
    <Pressable
      style={[styles.quickBtn, vybrany && styles.quickBtnVybrany, busy && ui.disabled]}
      disabled={busy}
      onPress={() => onPress(typ)}
    >
      <Text style={[styles.quickBtnText, vybrany && styles.quickBtnTextVybrany]}>
        {typLabel(typ)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    gap: 2,
    paddingVertical: spacing.lg,
  },
  name: { fontSize: font.xl, fontWeight: "800", color: colors.text },
  clock: {
    fontSize: 56,
    fontWeight: "800",
    color: colors.primary,
    fontVariant: ["tabular-nums"],
  },
  center: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  uid: {
    fontSize: font.xl,
    fontWeight: "800",
    color: colors.text,
    fontFamily: "monospace",
    letterSpacing: 1,
    paddingVertical: spacing.xs,
  },
  bigBtn: {
    minHeight: 120,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  bigBtnLabel: { color: colors.primaryText, fontSize: 28, fontWeight: "800" },
  bigBtnTyp: { color: colors.primaryText, fontSize: font.lg, fontWeight: "600" },
  odpocet: {
    textAlign: "center",
    fontSize: font.lg,
    fontWeight: "700",
    color: colors.primary,
    fontVariant: ["tabular-nums"],
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  quickBtn: {
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  quickBtnVybrany: { backgroundColor: colors.primary },
  quickBtnText: {
    color: colors.primary,
    fontSize: font.md,
    fontWeight: "700",
    textAlign: "center",
  },
  quickBtnTextVybrany: { color: colors.primaryText },
});
