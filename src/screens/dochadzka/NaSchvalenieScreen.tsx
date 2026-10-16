import React, { useCallback, useState } from "react";
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
import { useNaSchvalenie } from "../../hooks/useDochadzkaZiadosti";
import { cs } from "../../i18n/cs";
import { colors } from "../../theme";
import type { DochadzkaStackParamList } from "./DochadzkaNavigator";
import { ui } from "./dochadzkaUi";
import { SkupinaPopis } from "./ziadostiUi";

type Props = NativeStackScreenProps<DochadzkaStackParamList, "DochadzkaNaSchvalenie">;

const T = cs.zadosti.keSchvaleni;

export function NaSchvalenieScreen({ navigation }: Props) {
  const q = useNaSchvalenie();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await q.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [q]);

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

        {q.jeHR ? <Text style={ui.cardMeta}>{T.hr}</Text> : null}
        {!q.jeSchvalovatel && !q.isLoading ? (
          <Text style={ui.muted}>{T.nejsteSchvalovatel}</Text>
        ) : null}
        {q.isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {q.error ? (
          <Text style={ui.error} selectable>
            {q.error instanceof Error ? q.error.message : String(q.error)}
          </Text>
        ) : null}
        {q.jeSchvalovatel && !q.isLoading && !q.skupiny.length ? (
          <Text style={ui.muted}>{T.prazdne}</Text>
        ) : null}

        {q.skupiny.map((s) => (
          <Pressable
            key={s.key}
            onPress={() => navigation.navigate("DochadzkaZiadostDetail", { key: s.key })}
          >
            <SkupinaPopis s={s} meno={s.zamestnanecEmail} />
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
