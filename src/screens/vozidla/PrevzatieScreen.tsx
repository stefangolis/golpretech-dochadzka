import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { PREVZATIE_STAV } from "../../api/rezervacieFields";
import { FotkyPicker } from "../../components/FotkyPicker";
import { useKeyboardHeight } from "../../hooks/useKeyboardHeight";
import {
  usePoslednyOdovzdanyKm,
  usePrevziatRezervaciu,
  useVozidla,
} from "../../hooks/useVozidla";
import { colors, spacing } from "../../theme";
import { formatRezervaciaObdobie } from "../../utils/rezervacie";
import { krokStyles as styles, parseKm, potvrditAsync, VolbaDvoch } from "./krokUi";
import type { VozidlaStackParamList } from "./VozidlaNavigator";

type PrevzatieStav = (typeof PREVZATIE_STAV)[keyof typeof PREVZATIE_STAV];

const STAV_OPTIONS = [
  { value: PREVZATIE_STAV.bezVyhrad, label: "Bez výhrad" },
  { value: PREVZATIE_STAV.sVyhradou, label: "S výhradou" },
] as const;

export function PrevzatieScreen() {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const navigation =
    useNavigation<NativeStackNavigationProp<VozidlaStackParamList>>();
  const route = useRoute<RouteProp<VozidlaStackParamList, "Prevzatie">>();
  const rezervacia = route.params.rezervacia;

  const vozidlaQuery = useVozidla();
  const poslednyKmQuery = usePoslednyOdovzdanyKm(rezervacia.vozidloSpz);
  const prevziat = usePrevziatRezervaciu();

  const vozidlo = useMemo(() => {
    const spz = rezervacia.vozidloSpz.trim().toLowerCase();
    return (vozidlaQuery.data ?? []).find(
      (v) => v.spz.trim().toLowerCase() === spz,
    );
  }, [vozidlaQuery.data, rezervacia.vozidloSpz]);

  const kmLoading = poslednyKmQuery.isLoading || vozidlaQuery.isLoading;
  const poslednyZnamyKm = kmLoading
    ? null
    : (poslednyKmQuery.data ?? vozidlo?.poslednyStavKm ?? null);

  const [km, setKm] = useState("");
  const [kmTouched, setKmTouched] = useState(false);
  const [stav, setStav] = useState<PrevzatieStav | null>(null);
  const [vyhrada, setVyhrada] = useState("");
  const [fotky, setFotky] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  useEffect(() => {
    if (kmTouched || poslednyZnamyKm == null) return;
    setKm(String(poslednyZnamyKm));
  }, [poslednyZnamyKm, kmTouched]);

  const sVyhradou = stav === PREVZATIE_STAV.sVyhradou;
  const pending = prevziat.isPending;

  const onSave = async () => {
    setError(null);
    const kmNum = parseKm(km);
    if (kmNum == null) {
      setError("Zadajte stav tachometra (celé číslo v km).");
      return;
    }
    if (!stav) {
      setError("Vyberte stav vozidla.");
      return;
    }
    if (sVyhradou && !vyhrada.trim()) {
      setError("Popíšte výhradu.");
      return;
    }
    if (sVyhradou && fotky.length === 0) {
      setError("Pri výhrade pridajte aspoň 1 fotku.");
      return;
    }
    if (poslednyZnamyKm != null && kmNum < poslednyZnamyKm) {
      const ok = await potvrditAsync(
        "Stav tachometra",
        `Stav je nižší ako posledný známy (${poslednyZnamyKm} km). Skontrolujte.`,
      );
      if (!ok) return;
    }

    try {
      await prevziat.mutateAsync({
        id: rezervacia.id,
        data: {
          km: kmNum,
          prevzatieStav: stav,
          vyhrada: sVyhradou ? vyhrada : "",
        },
        fotky: sVyhradou ? fotky : [],
        onProgress: (done, total) => setProgress(`Nahrávam ${done}/${total}…`),
      });
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProgress(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + spacing.xl * 2 + keyboardHeight },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topBar}>
            <Pressable
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
              disabled={pending}
            >
              <Text style={styles.backBtnText}>← Späť</Text>
            </Pressable>
            <Text style={styles.topBarTitle}>Prevzatie vozidla</Text>
            <View style={styles.backBtnPlaceholder} />
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>
              {vozidlo?.nazov ?? rezervacia.vozidloSpz}
              {rezervacia.vozidloSpz ? ` · ${rezervacia.vozidloSpz}` : ""}
            </Text>
            <Text style={styles.summarySub}>
              {formatRezervaciaObdobie(rezervacia.od, rezervacia.do)}
            </Text>
          </View>

          <Text style={styles.label}>Stav tachometra (km) *</Text>
          <TextInput
            style={styles.input}
            value={km}
            onChangeText={(t) => {
              setKmTouched(true);
              setKm(t);
            }}
            keyboardType="number-pad"
            placeholder={kmLoading ? "Načítavam posledný stav…" : "napr. 125430"}
            placeholderTextColor={colors.muted}
            editable={!pending}
          />
          {poslednyZnamyKm != null ? (
            <Text style={styles.muted}>
              Posledný známy stav: {poslednyZnamyKm} km
            </Text>
          ) : null}

          <Text style={styles.label}>Stav vozidla *</Text>
          <VolbaDvoch
            value={stav}
            options={STAV_OPTIONS}
            onChange={setStav}
            disabled={pending}
          />

          {sVyhradou ? (
            <>
              <Text style={styles.label}>Výhrada *</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={vyhrada}
                onChangeText={setVyhrada}
                placeholder="napr. škrabanec na zadnom nárazníku"
                placeholderTextColor={colors.muted}
                multiline
                editable={!pending}
              />
              <Text style={styles.label}>Fotky (1–5) *</Text>
              <FotkyPicker
                fotky={fotky}
                onChange={setFotky}
                disabled={pending}
              />
            </>
          ) : null}

          {error ? (
            <Text style={styles.error} selectable>
              {error}
            </Text>
          ) : null}
          {progress ? <Text style={styles.progress}>{progress}</Text> : null}

          <Pressable
            style={[styles.submitBtn, pending && styles.submitDisabled]}
            disabled={pending}
            onPress={() => {
              Keyboard.dismiss();
              void onSave();
            }}
          >
            {pending && !progress ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text style={styles.submitText}>
                {prevziat.isError ? "Skúsiť znovu" : "Prevziať vozidlo"}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
