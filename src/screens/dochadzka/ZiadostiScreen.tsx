import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { usePragueToday } from "../../hooks/useDochadzka";
import {
  useMojeZiadosti,
  useNaSchvalenie,
  useZrusitZiadost,
  ZIADOSTI_ZOZNAM_DNI,
} from "../../hooks/useDochadzkaZiadosti";
import { cs } from "../../i18n/cs";
import { colors, spacing } from "../../theme";
import { pragueDayStartUtcMs } from "../../utils/dochadzkaVypocet";
import {
  mozeZrusitSkupinu,
  popisDnaZiadosti,
  pridajDni,
  rozdelPreZrusenie,
  zoskupZiadosti,
  type ZiadostSkupina,
} from "../../utils/dochadzkaZiadosti";
import type { DochadzkaStackParamList } from "./DochadzkaNavigator";
import { ui } from "./dochadzkaUi";
import { SkupinaPopis } from "./ziadostiUi";

type Props = NativeStackScreenProps<DochadzkaStackParamList, "DochadzkaZiadosti">;

const T = cs.zadosti.seznam;
const TZ = cs.zadosti.zruseni;

function textZrusenia(s: ZiadostSkupina, nowMs: number): string {
  const { zrusit, ostava } = rozdelPreZrusenie(s.polozky, nowMs);
  const riadky = [TZ.zrusiSe, ...zrusit.map((p) => `• ${popisDnaZiadosti(p)}`)];
  if (ostava.length) {
    riadky.push("", TZ.zustava, ...ostava.map((p) => `• ${popisDnaZiadosti(p)}`));
  }
  return riadky.join("\n");
}

export function ZiadostiScreen({ navigation }: Props) {
  const dnes = usePragueToday();
  const moje = useMojeZiadosti();
  const naSchvalenie = useNaSchvalenie();
  const zrusit = useZrusitZiadost();
  const [naZrusenie, setNaZrusenie] = useState<ZiadostSkupina | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const skupiny = useMemo(() => {
    const odMs = pragueDayStartUtcMs(pridajDni(dnes, -ZIADOSTI_ZOZNAM_DNI));
    return zoskupZiadosti((moje.data ?? []).filter((z) => Date.parse(z.do) >= odMs));
  }, [dnes, moje.data]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([moje.refetch(), naSchvalenie.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [moje, naSchvalenie]);

  const otvorZrusenie = (s: ZiadostSkupina) => {
    zrusit.reset();
    setNaZrusenie(s);
  };

  const potvrdZrusenie = () => {
    if (!naZrusenie) return;
    const ids = rozdelPreZrusenie(naZrusenie.polozky, Date.now()).zrusit.map((p) => p.id);
    zrusit.mutate(ids, { onSuccess: () => setNaZrusenie(null) });
  };

  const chybaZrusenia =
    zrusit.error instanceof Error ? zrusit.error.message : zrusit.error ? String(zrusit.error) : null;

  return (
    <SafeAreaView style={ui.safe} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={ui.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={ui.topBar}>
          <Pressable style={ui.backBtn} onPress={() => navigation.goBack()}>
            <Text style={ui.backBtnText}>{cs.spolecne.zpet}</Text>
          </Pressable>
          <Text style={ui.topBarTitle}>{T.titulek}</Text>
          <View style={ui.backBtnPlaceholder} />
        </View>

        <Pressable
          style={ui.primaryBtn}
          onPress={() => navigation.navigate("DochadzkaNovaZiadost")}
        >
          <Text style={ui.primaryBtnText}>{cs.zadosti.nova.titulek}</Text>
        </Pressable>

        {naSchvalenie.jeSchvalovatel ? (
          <Pressable
            style={ui.secondaryBtn}
            onPress={() => navigation.navigate("DochadzkaNaSchvalenie")}
          >
            <Text style={ui.secondaryBtnText}>{T.keSchvaleni(naSchvalenie.pocet)}</Text>
          </Pressable>
        ) : null}

        <Text style={ui.sectionTitle}>{T.mojeZadosti}</Text>
        <Text style={ui.cardMeta}>{T.obdobi(ZIADOSTI_ZOZNAM_DNI)}</Text>
        {moje.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {moje.error ? (
          <Text style={ui.error} selectable>
            {moje.error instanceof Error ? moje.error.message : String(moje.error)}
          </Text>
        ) : null}
        {!moje.isLoading && !skupiny.length ? <Text style={ui.muted}>{T.prazdne}</Text> : null}

        {skupiny.map((s) => (
          <SkupinaPopis key={s.key} s={s}>
            {mozeZrusitSkupinu(s, Date.now()) ? (
              <Pressable
                style={[ui.secondaryBtn, { marginTop: spacing.xs }]}
                onPress={() => otvorZrusenie(s)}
              >
                <Text style={ui.secondaryBtnText}>{TZ.tlacitko}</Text>
              </Pressable>
            ) : null}
          </SkupinaPopis>
        ))}
      </ScrollView>

      <ConfirmDialog
        visible={!!naZrusenie}
        title={TZ.titulek}
        message={naZrusenie ? textZrusenia(naZrusenie, Date.now()) : undefined}
        confirmLabel={TZ.potvrdit}
        cancelLabel={TZ.ponechat}
        destructive
        busy={zrusit.isPending}
        error={chybaZrusenia}
        onConfirm={potvrdZrusenie}
        onClose={() => setNaZrusenie(null)}
      />
    </SafeAreaView>
  );
}
