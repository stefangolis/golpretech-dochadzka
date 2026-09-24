import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../auth/AuthContext";
import { useMyEntries } from "../hooks/useMyEntries";
import { useMojeRezervacie, useVozidla } from "../hooks/useVozidla";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors, font, spacing } from "../theme";
import { todayDateOnly } from "../utils/dates";
import { hubVozidlaStatusText } from "../utils/rezervacie";

export function HubScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, signOut } = useAuth();
  const myEntriesQuery = useMyEntries();
  const mojeRezervacieQuery = useMojeRezervacie();
  const vozidlaQuery = useVozidla();

  const today = todayDateOnly();

  const odvodStatus = useMemo(() => {
    const entries = myEntriesQuery.data ?? [];
    const todayMin = entries
      .filter((e) => e.datum === today)
      .reduce((sum, e) => sum + (e.minuty || 0), 0);
    if (todayMin <= 0) return "Dnes bez zápisu";
    return `Dnes zapísané: ${todayMin} min`;
  }, [myEntriesQuery.data, today]);

  const vozidlaStatus = useMemo(() => {
    if (mojeRezervacieQuery.isLoading || vozidlaQuery.isLoading) {
      return "Načítavam…";
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
      <View style={styles.container}>
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>Golpretech</Text>
            <Text style={styles.userName} numberOfLines={1}>
              {user?.displayName}
            </Text>
            <Text style={styles.userEmail} numberOfLines={1}>
              {user?.email}
            </Text>
          </View>
          <Pressable style={styles.logoutBtn} onPress={() => void signOut()}>
            <Text style={styles.logoutText}>Odhlásiť</Text>
          </Pressable>
        </View>

        <Text style={styles.heading}>Čo chcete robiť?</Text>

        <Pressable
          style={styles.tile}
          onPress={() => navigation.navigate("Home")}
        >
          <Text style={styles.tileTitle}>Odvod hodín</Text>
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
          <Text style={styles.tileTitle}>Vozidlá</Text>
          <Text style={styles.tileStatus}>{vozidlaStatus}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
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
    textTransform: "uppercase",
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
