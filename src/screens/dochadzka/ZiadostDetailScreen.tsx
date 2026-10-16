import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { FormScrollView } from "../../components/FormScrollView";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../../auth/AuthContext";
import { useNaSchvalenie, useRozhodnutZiadost } from "../../hooks/useDochadzkaZiadosti";
import { cs } from "../../i18n/cs";
import { colors, font, spacing } from "../../theme";
import { smieRozhodnut } from "../../utils/dochadzkaZiadosti";
import type { DochadzkaStackParamList } from "./DochadzkaNavigator";
import { ui } from "./dochadzkaUi";
import { SkupinaPopis } from "./ziadostiUi";

type Props = NativeStackScreenProps<DochadzkaStackParamList, "DochadzkaZiadostDetail">;

const T = cs.zadosti.detail;

export function ZiadostDetailScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const q = useNaSchvalenie();
  const rozhodnut = useRozhodnutZiadost();
  const [zamietam, setZamietam] = useState(false);
  const [dovod, setDovod] = useState("");
  const [chyba, setChyba] = useState<string | null>(null);
  const [hotovo, setHotovo] = useState<string | null>(null);

  const s = q.skupiny.find((x) => x.key === route.params.key);
  const smie = !!s && s.polozky.every((p) => smieRozhodnut(p, user?.email ?? "", q.jeHR));

  const rozhodni = (schvalit: boolean) => {
    if (!s || !smie) return;
    setChyba(null);
    if (!schvalit && !dovod.trim()) {
      setChyba(cs.zadosti.api.vyplnteDuvodZamitnuti);
      return;
    }
    const ids = s.polozky.map((p) => p.id);
    rozhodnut.mutate(
      schvalit ? { ids, schvalit: true } : { ids, schvalit: false, dovod },
      {
        onSuccess: () => {
          setHotovo(schvalit ? T.schvaleno : T.zamitnuto);
        },
        onError: (err) => setChyba(err instanceof Error ? err.message : String(err)),
      },
    );
  };

  return (
    <SafeAreaView style={ui.safe} edges={["top", "left", "right"]}>
      <FormScrollView contentContainerStyle={ui.scroll}>
        <View style={ui.topBar}>
          <Pressable style={ui.backBtn} onPress={() => navigation.goBack()}>
            <Text style={ui.backBtnText}>{cs.spolecne.zpet}</Text>
          </Pressable>
          <Text style={ui.topBarTitle}>{T.titulek}</Text>
          <View style={ui.backBtnPlaceholder} />
        </View>

        {q.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {!q.isLoading && !s ? <Text style={ui.muted}>{T.uzNeceka}</Text> : null}

        {s ? (
          <>
            <SkupinaPopis s={s} meno={s.zamestnanecEmail} />

            {!smie ? (
              <Text style={ui.error}>{T.nemuzete}</Text>
            ) : (
              <>
                {zamietam ? (
                  <View style={{ gap: 4 }}>
                    <Text style={ui.cardMeta}>{T.duvodZamitnuti}</Text>
                    <TextInput
                      style={styles.input}
                      value={dovod}
                      onChangeText={setDovod}
                      multiline
                      autoFocus
                    />
                  </View>
                ) : null}
                {chyba ? (
                  <Text style={ui.error} selectable>
                    {chyba}
                  </Text>
                ) : null}
                {rozhodnut.isPending ? (
                  <ActivityIndicator color={colors.primary} />
                ) : zamietam ? (
                  <View style={styles.row}>
                    <Pressable
                      style={[ui.secondaryBtn, { flex: 1 }]}
                      onPress={() => setZamietam(false)}
                    >
                      <Text style={ui.secondaryBtnText}>{cs.dochazka.zapis.zpet}</Text>
                    </Pressable>
                    <Pressable style={[styles.dangerBtn, { flex: 1 }]} onPress={() => rozhodni(false)}>
                      <Text style={styles.dangerBtnText}>{T.zamitnout}</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.row}>
                    <Pressable style={[styles.dangerBtn, { flex: 1 }]} onPress={() => setZamietam(true)}>
                      <Text style={styles.dangerBtnText}>{T.zamitnoutTri}</Text>
                    </Pressable>
                    <Pressable style={[ui.primaryBtn, { flex: 1 }]} onPress={() => rozhodni(true)}>
                      <Text style={ui.primaryBtnText}>{T.schvalit}</Text>
                    </Pressable>
                  </View>
                )}
              </>
            )}
          </>
        ) : null}
      </FormScrollView>
      <ConfirmDialog
        visible={!!hotovo}
        hideCancel
        title={hotovo ?? ""}
        confirmLabel={cs.spolecne.ok}
        onConfirm={() => {
          setHotovo(null);
          navigation.goBack();
        }}
        onClose={() => {
          setHotovo(null);
          navigation.goBack();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  input: {
    minHeight: 80,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.sm,
    fontSize: font.md,
    color: colors.text,
    textAlignVertical: "top",
  },
  dangerBtn: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.danger,
    backgroundColor: "#FDECEA",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  dangerBtnText: { color: colors.danger, fontSize: font.lg, fontWeight: "800" },
});
