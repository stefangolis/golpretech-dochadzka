import React, { useMemo, useState } from "react";
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
import { ODOVZDANIE_STAV } from "../../api/rezervacieFields";
import { FotkyPicker } from "../../components/FotkyPicker";
import { useKeyboardHeight } from "../../hooks/useKeyboardHeight";
import { useOdovzdatRezervaciu, useVozidla } from "../../hooks/useVozidla";
import { colors, spacing } from "../../theme";
import { formatDateShort, todayDateOnly } from "../../utils/dates";
import { formatRezervaciaObdobie } from "../../utils/rezervacie";
import { krokStyles as styles, parseKm, potvrditAsync, VolbaDvoch } from "./krokUi";
import type { VozidlaStackParamList } from "./VozidlaNavigator";

type OdovzdanieStav = (typeof ODOVZDANIE_STAV)[keyof typeof ODOVZDANIE_STAV];

const STAV_OPTIONS = [
  { value: ODOVZDANIE_STAV.bezPoskodenia, label: "Bez poškodenia" },
  { value: ODOVZDANIE_STAV.sPoskodenim, label: "S poškodením" },
] as const;

/** Nad túto hodnotu najazdených km sa zobrazí varovanie. */
const VAROVANIE_KM = 2000;

export function OdovzdanieScreen() {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const navigation =
    useNavigation<NativeStackNavigationProp<VozidlaStackParamList>>();
  const route = useRoute<RouteProp<VozidlaStackParamList, "Odovzdanie">>();
  const rezervacia = route.params.rezervacia;
  const today = todayDateOnly();

  const vozidlaQuery = useVozidla();
  const odovzdat = useOdovzdatRezervaciu();

  const vozidlo = useMemo(() => {
    const spz = rezervacia.vozidloSpz.trim().toLowerCase();
    return (vozidlaQuery.data ?? []).find(
      (v) => v.spz.trim().toLowerCase() === spz,
    );
  }, [vozidlaQuery.data, rezervacia.vozidloSpz]);
  const nazovVozidla = vozidlo?.nazov ?? rezervacia.vozidloSpz;
  const prevzatieKm = rezervacia.prevzatieKm;

  const [km, setKm] = useState(prevzatieKm != null ? String(prevzatieKm) : "");
  const [stav, setStav] = useState<OdovzdanieStav | null>(null);
  const [poskodenie, setPoskodenie] = useState("");
  const [fotky, setFotky] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const sPoskodenim = stav === ODOVZDANIE_STAV.sPoskodenim;
  const pending = odovzdat.isPending;
  const skorsie = today < rezervacia.do;

  const onSave = async () => {
    setError(null);
    const kmNum = parseKm(km);
    if (kmNum == null) {
      setError("Zadajte stav tachometra (celé číslo v km).");
      return;
    }
    if (prevzatieKm != null && kmNum < prevzatieKm) {
      setError(
        `Stav tachometra nemôže byť nižší ako pri prevzatí (${prevzatieKm} km).`,
      );
      return;
    }
    if (!stav) {
      setError("Vyberte stav vozidla.");
      return;
    }
    if (sPoskodenim && !poskodenie.trim()) {
      setError("Popíšte poškodenie.");
      return;
    }
    if (sPoskodenim && fotky.length === 0) {
      setError("Pri poškodení pridajte aspoň 1 fotku.");
      return;
    }
    const najazdeneKm = prevzatieKm != null ? kmNum - prevzatieKm : null;
    if (najazdeneKm != null && najazdeneKm > VAROVANIE_KM) {
      const ok = await potvrditAsync(
        "Stav tachometra",
        `Najazdených ${najazdeneKm} km (viac ako ${VAROVANIE_KM} km). Skontrolujte stav tachometra.`,
      );
      if (!ok) return;
    }

    try {
      await odovzdat.mutateAsync({
        id: rezervacia.id,
        od: rezervacia.od,
        do: rezervacia.do,
        vozidloSpz: rezervacia.vozidloSpz,
        nazovVozidla,
        data: {
          km: kmNum,
          odovzdanieStav: stav,
          poskodenie: sPoskodenim ? poskodenie : "",
          najazdeneKm,
        },
        fotky: sPoskodenim ? fotky : [],
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
            <Text style={styles.topBarTitle}>Odovzdanie vozidla</Text>
            <View style={styles.backBtnPlaceholder} />
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>
              {nazovVozidla}
              {rezervacia.vozidloSpz ? ` · ${rezervacia.vozidloSpz}` : ""}
            </Text>
            <Text style={styles.summarySub}>
              {formatRezervaciaObdobie(rezervacia.od, rezervacia.do)}
            </Text>
            {skorsie ? (
              <Text style={styles.muted}>
                Odovzdávate skôr — rezervácia sa ukončí dnes (pôvodne do{" "}
                {formatDateShort(rezervacia.do)}).
              </Text>
            ) : null}
          </View>

          <Text style={styles.label}>Stav tachometra (km) *</Text>
          <TextInput
            style={styles.input}
            value={km}
            onChangeText={setKm}
            keyboardType="number-pad"
            placeholder="napr. 125430"
            placeholderTextColor={colors.muted}
            editable={!pending}
          />
          {prevzatieKm != null ? (
            <Text style={styles.muted}>Pri prevzatí: {prevzatieKm} km</Text>
          ) : null}

          <Text style={styles.label}>Stav vozidla *</Text>
          <VolbaDvoch
            value={stav}
            options={STAV_OPTIONS}
            onChange={setStav}
            disabled={pending}
          />

          {sPoskodenim ? (
            <>
              <Text style={styles.label}>Popis poškodenia *</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={poskodenie}
                onChangeText={setPoskodenie}
                placeholder="čo a kde je poškodené"
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
                {odovzdat.isError ? "Skúsiť znovu" : "Odovzdať vozidlo"}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
