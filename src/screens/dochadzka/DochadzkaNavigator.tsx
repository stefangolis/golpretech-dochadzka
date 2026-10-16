import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useMojeOpravnenia } from "../../hooks/useDochadzkaZiadosti";
import { cs } from "../../i18n/cs";
import { navigationRef } from "../../navigation/navigationRef";
import { colors } from "../../theme";
import { DnesScreen } from "./DnesScreen";
import { MesiacScreen } from "./MesiacScreen";
import { NaSchvalenieScreen } from "./NaSchvalenieScreen";
import { NovaZiadostScreen } from "./NovaZiadostScreen";
import { ZapisScreen } from "./ZapisScreen";
import { ZiadostDetailScreen } from "./ZiadostDetailScreen";
import { ZiadostiScreen } from "./ZiadostiScreen";

export type ZapisParams =
  | { zdroj: "NFC"; tagUid: string; casTuknutia: string }
  | { zdroj: "Mobil" };

export type DochadzkaStackParamList = {
  DochadzkaDnes: { potvrdenie?: string } | undefined;
  DochadzkaZapis: ZapisParams;
  DochadzkaMesiac: undefined;
  DochadzkaZiadosti: undefined;
  DochadzkaNovaZiadost: undefined;
  DochadzkaNaSchvalenie: undefined;
  /** key = kľúč skupiny zo zoskupZiadosti */
  DochadzkaZiadostDetail: { key: string };
};

const Stack = createNativeStackNavigator<DochadzkaStackParamList>();

export function DochadzkaNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DochadzkaDnes" component={DnesScreen} />
      <Stack.Screen name="DochadzkaZapis" component={ZapisScreen} />
      <Stack.Screen name="DochadzkaMesiac" component={MesiacScreen} />
      <Stack.Screen name="DochadzkaZiadosti" component={ZiadostiScreen} />
      <Stack.Screen name="DochadzkaNovaZiadost" component={NovaZiadostScreen} />
      <Stack.Screen name="DochadzkaNaSchvalenie" component={NaSchvalenieScreen} />
      <Stack.Screen name="DochadzkaZiadostDetail" component={ZiadostDetailScreen} />
    </Stack.Navigator>
  );
}

/** Neotvorí modul, kým nie je známe, že e-mail je v DochadzkaOpravnenia. */
export function DochadzkaPristupGate() {
  const opravnenia = useMojeOpravnenia();
  const vSezname = opravnenia.data?.vSezname === true;
  const caka = !opravnenia.data && (opravnenia.isPending || opravnenia.isFetching);
  const [dialog, setDialog] = useState(false);

  useEffect(() => {
    if (caka) return;
    if (!vSezname) setDialog(true);
  }, [caka, vSezname]);

  const spatDoHubu = () => {
    setDialog(false);
    if (navigationRef.isReady()) navigationRef.navigate("Hub");
  };

  if (caka) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (!vSezname) {
    return (
      <View style={styles.boot}>
        <ConfirmDialog
          visible={dialog}
          hideCancel
          title={cs.dochazka.pristup.titulek}
          message={cs.dochazka.pristup.text}
          confirmLabel={cs.spolecne.ok}
          onConfirm={spatDoHubu}
          onClose={spatDoHubu}
        />
      </View>
    );
  }
  return <DochadzkaNavigator />;
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
});
