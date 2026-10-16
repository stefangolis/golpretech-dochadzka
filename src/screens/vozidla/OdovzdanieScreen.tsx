import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
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
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { FormScrollView } from "../../components/FormScrollView";
import { FotkyPicker } from "../../components/FotkyPicker";
import { cs } from "../../i18n/cs";
import { useOdovzdatRezervaciu, useVozidla } from "../../hooks/useVozidla";
import { colors, spacing } from "../../theme";
import { formatDateShort, todayDateOnly } from "../../utils/dates";
import { formatRezervaciaObdobie } from "../../utils/rezervacie";
import { krokStyles as styles, parseKm, VolbaDvoch } from "./krokUi";
import type { VozidlaStackParamList } from "./VozidlaNavigator";

type OdovzdanieStav = (typeof ODOVZDANIE_STAV)[keyof typeof ODOVZDANIE_STAV];

const T = cs.vozidla.odevzdani;
const STAV_OPTIONS = [
  { value: ODOVZDANIE_STAV.bezPoskodenia, label: T.bezPoskozeni },
  { value: ODOVZDANIE_STAV.sPoskodenim, label: T.sPoskozenim },
] as const;

/** Nad túto hodnotu najazdených km sa zobrazí varovanie. */
const VAROVANIE_KM = 2000;

export function OdovzdanieScreen() {
  const insets = useSafeAreaInsets();
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
  const [kmConfirm, setKmConfirm] = useState<{
    kmNum: number;
    najazdene: number;
  } | null>(null);

  const sPoskodenim = stav === ODOVZDANIE_STAV.sPoskodenim;
  const pending = odovzdat.isPending;
  const skorsie = today < rezervacia.do;

  const onSave = async () => {
    setError(null);
    const kmNum = parseKm(km);
    if (kmNum == null) {
      setError(cs.vozidla.prevzeti.zadajteKm);
      return;
    }
    if (prevzatieKm != null && kmNum < prevzatieKm) {
      setError(T.nizsiNezPrevzeti(prevzatieKm));
      return;
    }
    if (!stav) {
      setError(cs.vozidla.prevzeti.vyberteStav);
      return;
    }
    if (sPoskodenim && !poskodenie.trim()) {
      setError(T.popisPoskozeniChyba);
      return;
    }
    if (sPoskodenim && fotky.length === 0) {
      setError(T.pridejteFotku);
      return;
    }
    const najazdeneKm = prevzatieKm != null ? kmNum - prevzatieKm : null;
    if (najazdeneKm != null && najazdeneKm > VAROVANIE_KM) {
      setKmConfirm({ kmNum, najazdene: najazdeneKm });
      return;
    }
    await dokoncOdovzdanie(kmNum);
  };

  const dokoncOdovzdanie = async (kmNum: number) => {
    if (!stav) return;
    const najazdeneKm = prevzatieKm != null ? kmNum - prevzatieKm : null;
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
        onProgress: (done, total) =>
          setProgress(cs.vozidla.fotky.nahravam(done, total)),
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
        <FormScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + spacing.xl * 2 },
          ]}
        >
          <View style={styles.topBar}>
            <Pressable
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
              disabled={pending}
            >
              <Text style={styles.backBtnText}>{cs.spolecne.zpet}</Text>
            </Pressable>
            <Text style={styles.topBarTitle}>{T.titulek}</Text>
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
                {T.skorsie(formatDateShort(rezervacia.do))}
              </Text>
            ) : null}
          </View>

          <Text style={styles.label}>{cs.vozidla.prevzeti.tachometr}</Text>
          <TextInput
            style={styles.input}
            value={km}
            onChangeText={setKm}
            keyboardType="number-pad"
            placeholder={cs.vozidla.prevzeti.placeholderKm}
            placeholderTextColor={colors.muted}
            editable={!pending}
          />
          {prevzatieKm != null ? (
            <Text style={styles.muted}>{T.priPrevzeti(prevzatieKm)}</Text>
          ) : null}

          <Text style={styles.label}>{cs.vozidla.prevzeti.stavVozidla}</Text>
          <VolbaDvoch
            value={stav}
            options={STAV_OPTIONS}
            onChange={setStav}
            disabled={pending}
          />

          {sPoskodenim ? (
            <>
              <Text style={styles.label}>{T.popisPoskozeni}</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={poskodenie}
                onChangeText={setPoskodenie}
                placeholder={T.poskozeniPlaceholder}
                placeholderTextColor={colors.muted}
                multiline
                editable={!pending}
              />
              <Text style={styles.label}>{cs.vozidla.prevzeti.fotky}</Text>
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
                {odovzdat.isError ? cs.spolecne.zkusitZnovu : T.odevzdatVozidlo}
              </Text>
            )}
          </Pressable>
        </FormScrollView>
      <ConfirmDialog
        visible={kmConfirm != null}
        title={cs.vozidla.prevzeti.tachometrTitulek}
        message={
          kmConfirm ? T.najeto(kmConfirm.najazdene, VAROVANIE_KM) : undefined
        }
        confirmLabel={cs.spolecne.pokracovat}
        cancelLabel={cs.spolecne.opravit}
        onConfirm={() => {
          const kmNum = kmConfirm?.kmNum;
          setKmConfirm(null);
          if (kmNum != null) void dokoncOdovzdanie(kmNum);
        }}
        onClose={() => setKmConfirm(null)}
      />
    </SafeAreaView>
  );
}
