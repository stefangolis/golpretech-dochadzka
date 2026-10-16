import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../../auth/AuthContext";
import {
  useDochadzkaDnes,
  useHlasZapnuty,
  useNfcStav,
  useOdoslatFrontu,
  useZapisBezNalepky,
  type ZobrazenaUdalost,
} from "../../hooks/useDochadzka";
import { useNaSchvalenie, useSchvaleneZiadosti } from "../../hooks/useDochadzkaZiadosti";
import { cs } from "../../i18n/cs";
import { colors } from "../../theme";
import {
  formatMinuty,
  pragueTimeLabel,
  typLabel,
  vypocitajDen,
  type ZiadostPreVypocet,
} from "../../utils/dochadzkaVypocet";
import { formatHodiny, popisTerminu, ziadostDruhLabel } from "../../utils/dochadzkaZiadosti";
import type { RootStackParamList } from "../../navigation/RootNavigator";
import { otvorNfcNastavenia } from "../../utils/nfc";
import type { DochadzkaStackParamList } from "./DochadzkaNavigator";
import { ui, useClock, useNfcPopredieNaZapis } from "./dochadzkaUi";

type Props = CompositeScreenProps<
  NativeStackScreenProps<DochadzkaStackParamList, "DochadzkaDnes">,
  NativeStackScreenProps<RootStackParamList>
>;

const T = cs.dochazka.dnes;

export function UdalostRow({ u }: { u: ZobrazenaUdalost }) {
  const zrusena = u.stav.toLowerCase() === "zrusena";
  return (
    <View style={ui.eventRow}>
      <Text style={[ui.eventTime, zrusena && ui.eventZrusena]}>
        {pragueTimeLabel(u.cas)}
      </Text>
      <Text style={[ui.eventTyp, zrusena && ui.eventZrusena]}>
        {typLabel(u.typ)}
      </Text>
      {u.caka ? <Text style={ui.badge}>{T.cekaNaOdeslani}</Text> : null}
      {zrusena ? <Text style={ui.badge}>{T.zrusena}</Text> : null}
      {!u.caka && !zrusena && u.zdroj ? (
        <Text style={ui.badge}>{u.zdroj}</Text>
      ) : null}
    </View>
  );
}

/** Schválená žiadosť v rámci dňa (SC/HO/SP s časom, dovolenka/NV v hodinách). */
export function ZiadostRow({ z }: { z: ZiadostPreVypocet }) {
  const absencia = z.druh === "Dovolenka" || z.druh === "NahradneVolno";
  return (
    <View style={ui.eventRow}>
      <Text style={ui.eventTyp}>
        {ziadostDruhLabel(z.druh)}{" "}
        {absencia
          ? formatHodiny(z.hodiny ?? 0)
          : popisTerminu({ druh: z.druh, od: z.od, do: z.do, polozky: [z] })}
      </Text>
      <Text style={ui.badge}>{T.schvaleno}</Text>
    </View>
  );
}

export function DnesScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const now = useClock(30_000);
  const { dnes, udalosti, server, vofronte, fronta } = useDochadzkaDnes();
  const bezNalepky = useZapisBezNalepky();
  const nfc = useNfcStav();
  const odoslat = useOdoslatFrontu();
  const ziadosti = useSchvaleneZiadosti();
  const naSchvalenie = useNaSchvalenie();
  const hlas = useHlasZapnuty();
  const [refreshing, setRefreshing] = useState(false);

  useNfcPopredieNaZapis();

  const potvrdenie = route.params?.potvrdenie;
  useEffect(() => {
    if (!potvrdenie) return;
    const t = setTimeout(() => navigation.setParams({ potvrdenie: undefined }), 8000);
    return () => clearTimeout(t);
  }, [navigation, potvrdenie]);

  const den = useMemo(
    () => vypocitajDen(udalosti, dnes, now, ziadosti.schvalene),
    [udalosti, dnes, now, ziadosti.schvalene],
  );
  const posledna = den.udalosti[den.udalosti.length - 1];

  const stavText = useMemo(() => {
    if (den.stav === "v_praci" && den.vPraciOd) {
      return T.vPraciOd(pragueTimeLabel(den.vPraciOd));
    }
    return T.mimoPraci;
  }, [den.stav, den.vPraciOd]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        server.refetch(),
        bezNalepky.refetch(),
        ziadosti.refetch(),
        naSchvalenie.jeSchvalovatel ? naSchvalenie.refetch() : Promise.resolve(),
      ]);
      nfc.obnovit();
    } finally {
      setRefreshing(false);
    }
  }, [bezNalepky, naSchvalenie, nfc, server, ziadosti]);

  const chybaFronty = fronta.find((p) => p.chyba)?.chyba;

  return (
    <SafeAreaView style={ui.safe} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={ui.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={ui.topBar}>
          <Pressable style={ui.backBtn} onPress={() => navigation.navigate("Hub")}>
            <Text style={ui.backBtnText}>{cs.spolecne.zpetHub}</Text>
          </Pressable>
          <Text style={ui.topBarTitle}>{cs.moduly.dochazka}</Text>
          <View style={ui.backBtnPlaceholder} />
        </View>

        {potvrdenie ? (
          <View style={ui.successBox}>
            <Text style={ui.successText}>{potvrdenie}</Text>
          </View>
        ) : null}

        <View style={ui.card}>
          <Text style={ui.cardMeta}>{user?.displayName}</Text>
          <Text style={{ fontSize: 24, fontWeight: "800", color: colors.primary }}>
            {stavText}
          </Text>
          {den.stav === "prerusenie" && posledna ? (
            <Text style={ui.cardMeta}>
              {T.preruseni(typLabel(posledna.typ), pragueTimeLabel(posledna.cas))}
            </Text>
          ) : null}
          <Text style={ui.cardTitle}>
            {T.odpracovano(formatMinuty(den.vysledneMin))}
            {den.otvorenyUsek ? T.prubezne : ""}
          </Text>
          {den.obedOdpocitany ? <Text style={ui.cardMeta}>{T.obed}</Text> : null}
          {den.sluzobnaCestaMin > 0 ? (
            <Text style={ui.cardMeta}>{T.zToSluzebniCesta(formatMinuty(den.sluzobnaCestaMin))}</Text>
          ) : null}
          {den.absenciaMin > 0 ? (
            <Text style={ui.cardMeta}>{T.dovolenaNv(formatMinuty(den.absenciaMin))}</Text>
          ) : null}
        </View>

        {naSchvalenie.pocet > 0 ? (
          <Pressable
            style={ui.card}
            onPress={() => navigation.navigate("DochadzkaNaSchvalenie")}
          >
            <Text style={ui.cardTitle}>{T.keSchvaleni(naSchvalenie.pocet)}</Text>
            <Text style={ui.cardMeta}>{T.keSchvaleniNapoveda}</Text>
          </Pressable>
        ) : null}

        {vofronte > 0 ? (
          <View style={ui.card}>
            <Text style={ui.cardTitle}>{T.veFronte(vofronte)}</Text>
            <Text style={ui.cardMeta}>{T.odesleSeSamo}</Text>
            {chybaFronty ? (
              <Text style={ui.error} selectable>
                {T.posledniChyba(chybaFronty)}
              </Text>
            ) : null}
            <Pressable
              style={[ui.secondaryBtn, odoslat.isPending && ui.disabled]}
              disabled={odoslat.isPending}
              onPress={() => odoslat.mutate()}
            >
              {odoslat.isPending ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={ui.secondaryBtnText}>{T.odeslatTed}</Text>
              )}
            </Pressable>
          </View>
        ) : null}

        {nfc.stav === "nepodporovane" ? (
          <View style={ui.card}>
            <Text style={ui.cardTitle}>{T.nfcNepodporovano}</Text>
            <Text style={ui.muted}>{T.nfcNepodporovanoText}</Text>
          </View>
        ) : nfc.stav === "vypnute" ? (
          <View style={ui.card}>
            <Text style={ui.cardTitle}>{T.nfcVypnuto}</Text>
            <Text style={ui.muted}>{T.nfcVypnutoText}</Text>
            <Pressable style={ui.secondaryBtn} onPress={() => void otvorNfcNastavenia()}>
              <Text style={ui.secondaryBtnText}>{T.nfcNastaveni}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={ui.card}>
            <Text style={ui.cardTitle}>{T.prilozTelefon}</Text>
            <Text style={ui.muted}>{T.prilozTelefonText}</Text>
          </View>
        )}

        {bezNalepky.data ? (
          <Pressable
            style={ui.primaryBtn}
            onPress={() => navigation.navigate("DochadzkaZapis", { zdroj: "Mobil" })}
          >
            <Text style={ui.primaryBtnText}>{T.bezNalepky}</Text>
          </Pressable>
        ) : null}

        <Text style={ui.sectionTitle}>{T.dnesniUdalosti}</Text>
        {server.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {server.error ? (
          <Text style={ui.error} selectable>
            {server.error instanceof Error ? server.error.message : String(server.error)}
          </Text>
        ) : null}
        <View style={ui.card}>
          {udalosti.length ? (
            udalosti.map((u) => <UdalostRow key={u.key} u={u} />)
          ) : !den.ziadosti.length ? (
            <Text style={ui.muted}>{T.zadnaUdalost}</Text>
          ) : null}
          {den.ziadosti.map((z, i) => (
            <ZiadostRow key={`${z.od}-${i}`} z={z} />
          ))}
        </View>

        <Pressable
          style={ui.secondaryBtn}
          onPress={() => navigation.navigate("DochadzkaMesiac")}
        >
          <Text style={ui.secondaryBtnText}>{T.mujMesic}</Text>
        </Pressable>
        <Pressable
          style={ui.secondaryBtn}
          onPress={() => navigation.navigate("DochadzkaZiadosti")}
        >
          <Text style={ui.secondaryBtnText}>{T.zadosti(naSchvalenie.pocet)}</Text>
        </Pressable>

        <View style={[ui.card, { flexDirection: "row", alignItems: "center" }]}>
          <View style={{ flex: 1 }}>
            <Text style={ui.cardTitle}>{T.hlas}</Text>
            <Text style={ui.cardMeta}>{T.hlasPopis}</Text>
          </View>
          <Switch
            value={hlas.zapnuty}
            onValueChange={hlas.nastav}
            trackColor={{ true: colors.primaryMuted, false: colors.border }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
