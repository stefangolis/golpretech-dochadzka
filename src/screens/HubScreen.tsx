import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../auth/AuthContext";
import { cs } from "../i18n/cs";
import { useDochadzkaDnes } from "../hooks/useDochadzka";
import { useMojeOpravnenia, useNaSchvalenie } from "../hooks/useDochadzkaZiadosti";
import { useMyEntries } from "../hooks/useMyEntries";
import { useMojeRezervacie, useVozidla } from "../hooks/useVozidla";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, font, spacing } from "../theme";
import { todayDateOnly } from "../utils/dates";
import { pragueTimeLabel, vypocitajDen } from "../utils/dochadzkaVypocet";
import { hubVozidlaStatusText } from "../utils/rezervacie";

const T = cs.hub;

export function HubScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, signOut } = useAuth();
  const myEntriesQuery = useMyEntries();
  const mojeRezervacieQuery = useMojeRezervacie();
  const vozidlaQuery = useVozidla();
  const dochadzka = useDochadzkaDnes();
  const opravnenia = useMojeOpravnenia();
  const naSchvalenie = useNaSchvalenie();
  const maPristupKDochadzce = opravnenia.data?.vSezname === true;

  const today = todayDateOnly();

  const dochadzkaStatus = useMemo(() => {
    if (dochadzka.server.isLoading) return cs.spolecne.nacitam;
    const den = vypocitajDen(dochadzka.udalosti, dochadzka.dnes);
    const stav =
      den.stav === "v_praci" && den.vPraciOd
        ? cs.dochazka.dnes.vPraciOd(pragueTimeLabel(den.vPraciOd))
        : cs.dochazka.dnes.mimoPraci;
    return dochadzka.vofronte ? T.veFronte(stav, dochadzka.vofronte) : stav;
  }, [dochadzka.dnes, dochadzka.server.isLoading, dochadzka.udalosti, dochadzka.vofronte]);

  const odvodStatus = useMemo(() => {
    const entries = myEntriesQuery.data ?? [];
    const todayMin = entries
      .filter((e) => e.datum === today)
      .reduce((sum, e) => sum + (e.minuty || 0), 0);
    if (todayMin <= 0) return T.dnesBezZaznamu;
    return T.dnesZapsano(todayMin);
  }, [myEntriesQuery.data, today]);

  const vozidlaStatus = useMemo(() => {
    if (mojeRezervacieQuery.isLoading || vozidlaQuery.isLoading) {
      return cs.spolecne.nacitam;
    }
    const bySpz = new Map(
      (vozidlaQuery.data ?? []).map((v) => [v.spz.trim().toLowerCase(), v.nazov]),
    );
    return hubVozidlaStatusText(
      mojeRezervacieQuery.data ?? [],
      today,
      (spz) => bySpz.get(spz.trim().toLowerCase()) ?? spz,
    );
  }, [mojeRezervacieQuery.data, mojeRezervacieQuery.isLoading, today, vozidlaQuery.data, vozidlaQuery.isLoading]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>{cs.nazov}</Text>
            <Text style={styles.userName} numberOfLines={1}>
              {user?.displayName}
            </Text>
            <Text style={styles.userEmail} numberOfLines={1}>
              {user?.email}
            </Text>
          </View>
          <Pressable style={styles.logoutBtn} onPress={() => void signOut()}>
            <Text style={styles.logoutText}>{T.odhlasit}</Text>
          </Pressable>
        </View>

        <Text style={styles.heading}>{T.coChceteDelat}</Text>

        <Pressable
          style={styles.tile}
          onPress={() => navigation.navigate("Home")}
        >
          <Text style={styles.tileTitle}>{cs.moduly.odvod}</Text>
          {myEntriesQuery.isLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.tileStatus}>{odvodStatus}</Text>
          )}
        </Pressable>

        <Pressable
          style={styles.tile}
          onPress={() => navigation.navigate("Vozidla")}
        >
          <Text style={styles.tileTitle}>{cs.moduly.vozidla}</Text>
          <Text style={styles.tileStatus}>{vozidlaStatus}</Text>
        </Pressable>

        {maPristupKDochadzce ? (
          <Pressable
            style={styles.tile}
            onPress={() => navigation.navigate("Dochadzka")}
          >
            <Text style={styles.tileTitle}>{cs.moduly.dochazka}</Text>
            <Text style={styles.tileStatus}>{dochadzkaStatus}</Text>
            {naSchvalenie.pocet > 0 ? (
              <Text style={styles.tileStatus}>{cs.dochazka.dnes.keSchvaleni(naSchvalenie.pocet)}</Text>
            ) : null}
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  brand: {
    fontSize: font.xs,
    fontWeight: "700",
    color: colors.primary,
    letterSpacing: 0.8,
  },
  userName: { fontSize: font.xl, fontWeight: "800", color: colors.text },
  userEmail: { fontSize: font.sm, color: colors.primaryMuted },
  logoutBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  logoutText: { fontSize: font.sm, fontWeight: "700", color: colors.primary },
  heading: {
    fontSize: font.lg,
    fontWeight: "800",
    color: colors.text,
    marginTop: spacing.sm,
  },
  tile: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    minHeight: 112,
    justifyContent: "center",
    gap: spacing.xs,
  },
  tileTitle: {
    fontSize: font.xxl,
    fontWeight: "800",
    color: colors.primary,
  },
  tileStatus: {
    fontSize: font.md,
    color: colors.muted,
    fontWeight: "600",
  },
});
