import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useDochadzkaMesiac, usePragueToday } from "../../hooks/useDochadzka";
import { useMojeZostatky, useSchvaleneZiadosti } from "../../hooks/useDochadzkaZiadosti";
import { cs } from "../../i18n/cs";
import { formatDatumPlny } from "../../i18n/datum";
import { colors, font, spacing } from "../../theme";
import {
  formatMinuty,
  shiftMonth,
  vypocitajMesiac,
} from "../../utils/dochadzkaVypocet";
import { formatHodiny } from "../../utils/dochadzkaZiadosti";
import {
  formatDni,
  formatHodinySoZnamienkom,
  mesacnyFond,
} from "../../utils/dochadzkaZostatky";
import type { DochadzkaStackParamList } from "./DochadzkaNavigator";
import {
  formatDenKratko,
  formatMesiac,
  ui,
  useClock,
  useNfcPopredieNaZapis,
} from "./dochadzkaUi";

type Props = NativeStackScreenProps<DochadzkaStackParamList, "DochadzkaMesiac">;

/** Najviac 3 mesiace dozadu od aktuálneho. */
const MAX_MESIACOV_DOZADU = 3;

const T = cs.dochazka.mesic;
const ZOSTATOK_NENASTAVENY = T.zustatekNenastaven;
const formatDatum = formatDatumPlny;

export function MesiacScreen({ navigation }: Props) {
  const dnes = usePragueToday();
  const now = useClock(60_000);
  const [posun, setPosun] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useNfcPopredieNaZapis();

  const [rok, mesiacDnes] = dnes.split("-").map(Number);
  const { year, month } = shiftMonth(rok, mesiacDnes, posun);
  const { server, udalosti } = useDochadzkaMesiac(year, month);
  const ziadosti = useSchvaleneZiadosti();
  const zostatky = useMojeZostatky();
  const dennyFondHod = zostatky.opravnenia.data?.dennyFondHod ?? 8;

  const mesiac = useMemo(
    () => vypocitajMesiac(udalosti, year, month, now, ziadosti.schvalene),
    [udalosti, year, month, now, ziadosti.schvalene],
  );
  const fond = useMemo(() => mesacnyFond(year, month, dennyFondHod), [year, month, dennyFondHod]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        server.refetch(),
        ziadosti.refetch(),
        zostatky.opravnenia.refetch(),
        zostatky.query.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [server, ziadosti, zostatky.opravnenia, zostatky.query]);

  const mozeSpat = posun > -MAX_MESIACOV_DOZADU;
  const mozeVpred = posun < 0;
  const dov = zostatky.dovolenka;
  const nad = zostatky.nadcasy;
  const chybaZostatkov = zostatky.query.error ?? zostatky.opravnenia.error;

  return (
    <SafeAreaView style={ui.safe} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={ui.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={ui.topBar}>
          <Pressable style={ui.backBtn} onPress={() => navigation.goBack()}>
            <Text style={ui.backBtnText}>{cs.spolecne.zpet}</Text>
          </Pressable>
          <Text style={ui.topBarTitle}>{cs.dochazka.dnes.mujMesic}</Text>
          <View style={ui.backBtnPlaceholder} />
        </View>

        <View style={styles.monthBar}>
          <Pressable
            style={[styles.arrow, !mozeSpat && ui.disabled]}
            disabled={!mozeSpat}
            onPress={() => setPosun((p) => p - 1)}
          >
            <Text style={styles.arrowText}>‹</Text>
          </Pressable>
          <Text style={styles.monthTitle}>{formatMesiac(year, month)}</Text>
          <Pressable
            style={[styles.arrow, !mozeVpred && ui.disabled]}
            disabled={!mozeVpred}
            onPress={() => setPosun((p) => p + 1)}
          >
            <Text style={styles.arrowText}>›</Text>
          </Pressable>
        </View>

        <View style={ui.card}>
          <Text style={ui.cardMeta}>{T.fond}</Text>
          <Text style={styles.big}>{formatHodiny(fond.hodiny)}</Text>
          <Text style={ui.cardMeta}>{T.fondPopis(fond.pracovneDni, formatHodiny(dennyFondHod))}</Text>
          {server.isLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={ui.cardMeta}>
              {T.odpracovano(formatMinuty(mesiac.spoluMin))}
              {mesiac.absenciaMin ? T.dovolenaNv(formatMinuty(mesiac.absenciaMin)) : ""}
            </Text>
          )}
          {mesiac.dniSChybou ? (
            <Text style={ui.warnText}>{T.chybiOdchod(mesiac.dniSChybou)}</Text>
          ) : null}
          {server.error ? (
            <Text style={ui.error} selectable>
              {server.error instanceof Error ? server.error.message : String(server.error)}
            </Text>
          ) : null}
        </View>

        <Text style={ui.sectionTitle}>{T.zustatky}</Text>
        {zostatky.nacitava ? <ActivityIndicator color={colors.primary} /> : null}
        {chybaZostatkov ? (
          <Text style={ui.error} selectable>
            {chybaZostatkov instanceof Error ? chybaZostatkov.message : String(chybaZostatkov)}
          </Text>
        ) : null}

        <View style={ui.card}>
          <Text style={ui.cardMeta}>{T.zustatekDovolene}</Text>
          {dov ? (
            <>
              <Text style={styles.big}>
                {formatHodiny(dov.hodiny)} · {formatDni(dov.dni)}
              </Text>
              {dov.naplanovaneHod ? (
                <Text style={ui.cardMeta}>
                  {T.naplanovano(formatHodiny(dov.naplanovaneHod), formatDni(dov.naplanovaneDni))}
                </Text>
              ) : null}
              {dov.cakaHod ? (
                <Text style={ui.cardMeta}>
                  {T.cekaNaSchvaleni(formatHodiny(dov.cakaHod), formatDni(dov.cakaDni))}
                </Text>
              ) : null}
              <Text style={ui.cardMeta}>{T.dovolenaStavK(formatDatum(dov.stavKDatumu))}</Text>
            </>
          ) : !zostatky.nacitava ? (
            <Text style={ui.muted}>{ZOSTATOK_NENASTAVENY}</Text>
          ) : null}
        </View>

        <View style={ui.card}>
          <Text style={ui.cardMeta}>{T.zustatekPrescasu}</Text>
          {nad ? (
            <>
              <Text style={styles.big}>{formatHodinySoZnamienkom(nad.hodiny)}</Text>
              {nad.od && nad.do ? (
                <Text style={ui.cardMeta}>
                  {formatDenKratko(nad.od)} – {formatDenKratko(nad.do)}:{" "}
                  {formatHodinySoZnamienkom(nad.zaObdobieHod)}
                </Text>
              ) : null}
              {nad.dniSChybou ? (
                <Text style={ui.warnText}>{T.chybiOdchodNeuplne(nad.dniSChybou)}</Text>
              ) : null}
              <Text style={ui.cardMeta}>{T.prescasyStavK(formatDatum(nad.stavKDatumu))}</Text>
            </>
          ) : !zostatky.nacitava ? (
            <Text style={ui.muted}>{ZOSTATOK_NENASTAVENY}</Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  monthBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  arrow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  arrowText: { fontSize: 28, fontWeight: "800", color: colors.primary },
  monthTitle: { fontSize: font.lg, fontWeight: "800", color: colors.text },
  big: { fontSize: font.xxl, fontWeight: "800", color: colors.primary },
});
