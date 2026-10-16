import React, { useEffect, useMemo, useState } from "react";
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
import { PREVZATIE_STAV } from "../../api/rezervacieFields";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { FormScrollView } from "../../components/FormScrollView";
import { FotkyPicker } from "../../components/FotkyPicker";
import { cs } from "../../i18n/cs";
import {
  usePoslednyOdovzdanyKm,
  usePrevziatRezervaciu,
  useVozidla,
} from "../../hooks/useVozidla";
import { colors, spacing } from "../../theme";
import { formatRezervaciaObdobie } from "../../utils/rezervacie";
import { krokStyles as styles, parseKm, VolbaDvoch } from "./krokUi";
import type { VozidlaStackParamList } from "./VozidlaNavigator";

type PrevzatieStav = (typeof PREVZATIE_STAV)[keyof typeof PREVZATIE_STAV];

const T = cs.vozidla.prevzeti;
const STAV_OPTIONS = [
  { value: PREVZATIE_STAV.bezVyhrad, label: T.bezVyhrad },
  { value: PREVZATIE_STAV.sVyhradou, label: T.sVyhradou },
] as const;

export function PrevzatieScreen() {
  const insets = useSafeAreaInsets();
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
  const [kmConfirm, setKmConfirm] = useState<{
    kmNum: number;
    znamy: number;
  } | null>(null);

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
      setError(T.zadajteKm);
      return;
    }
    if (!stav) {
      setError(T.vyberteStav);
      return;
    }
    if (sVyhradou && !vyhrada.trim()) {
      setError(T.popisVyhradu);
      return;
    }
    if (sVyhradou && fotky.length === 0) {
      setError(T.pridejteFotku);
      return;
    }
    if (poslednyZnamyKm != null && kmNum < poslednyZnamyKm) {
      setKmConfirm({ kmNum, znamy: poslednyZnamyKm });
      return;
    }
    await dokoncPrevzatie(kmNum);
  };

  const dokoncPrevzatie = async (kmNum: number) => {
    if (!stav) return;
    try {
      await prevziat.mutateAsync({
        id: rezervacia.id,
        data: {
          km: kmNum,
          prevzatieStav: stav,
          vyhrada: sVyhradou ? vyhrada : "",
        },
        fotky: sVyhradou ? fotky : [],
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
              {vozidlo?.nazov ?? rezervacia.vozidloSpz}
              {rezervacia.vozidloSpz ? ` · ${rezervacia.vozidloSpz}` : ""}
            </Text>
            <Text style={styles.summarySub}>
              {formatRezervaciaObdobie(rezervacia.od, rezervacia.do)}
            </Text>
          </View>

          <Text style={styles.label}>{T.tachometr}</Text>
          <TextInput
            style={styles.input}
            value={km}
            onChangeText={(t) => {
              setKmTouched(true);
              setKm(t);
            }}
            keyboardType="number-pad"
            placeholder={kmLoading ? T.nacitamKm : T.placeholderKm}
            placeholderTextColor={colors.muted}
            editable={!pending}
          />
          {poslednyZnamyKm != null ? (
            <Text style={styles.muted}>
              {T.posledniZnamy(poslednyZnamyKm)}
            </Text>
          ) : null}

          <Text style={styles.label}>{T.stavVozidla}</Text>
          <VolbaDvoch
            value={stav}
            options={STAV_OPTIONS}
            onChange={setStav}
            disabled={pending}
          />

          {sVyhradou ? (
            <>
              <Text style={styles.label}>{T.vyhrada}</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={vyhrada}
                onChangeText={setVyhrada}
                placeholder={T.vyhradaPlaceholder}
                placeholderTextColor={colors.muted}
                multiline
                editable={!pending}
              />
              <Text style={styles.label}>{T.fotky}</Text>
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
                {prevziat.isError ? cs.spolecne.zkusitZnovu : T.prevzitVozidlo}
              </Text>
            )}
          </Pressable>
        </FormScrollView>
      <ConfirmDialog
        visible={kmConfirm != null}
        title={T.tachometrTitulek}
        message={kmConfirm ? T.nizsiNezZnamy(kmConfirm.znamy) : undefined}
        confirmLabel={cs.spolecne.pokracovat}
        cancelLabel={cs.spolecne.opravit}
        onConfirm={() => {
          const kmNum = kmConfirm?.kmNum;
          setKmConfirm(null);
          if (kmNum != null) void dokoncPrevzatie(kmNum);
        }}
        onClose={() => setKmConfirm(null)}
      />
    </SafeAreaView>
  );
}
