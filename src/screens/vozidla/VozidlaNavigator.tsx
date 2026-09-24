import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { Rezervacia } from "../../api/rezervacieFields";
import { NovaRezervaciaScreen } from "./NovaRezervaciaScreen";
import { OdovzdanieScreen } from "./OdovzdanieScreen";
import { PrevzatieScreen } from "./PrevzatieScreen";
import { UpravitRezervaciuScreen } from "./UpravitRezervaciuScreen";
import { VozidlaHomeScreen } from "./VozidlaHomeScreen";

export type VozidlaStackParamList = {
  VozidlaHome: undefined;
  NovaRezervacia: undefined;
  UpravitRezervaciu: { rezervacia: Rezervacia };
  Prevzatie: { rezervacia: Rezervacia };
  Odovzdanie: { rezervacia: Rezervacia };
};

const Stack = createNativeStackNavigator<VozidlaStackParamList>();

export function VozidlaNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="VozidlaHome" component={VozidlaHomeScreen} />
      <Stack.Screen name="NovaRezervacia" component={NovaRezervaciaScreen} />
      <Stack.Screen
        name="UpravitRezervaciu"
        component={UpravitRezervaciuScreen}
      />
      <Stack.Screen name="Prevzatie" component={PrevzatieScreen} />
      <Stack.Screen name="Odovzdanie" component={OdovzdanieScreen} />
    </Stack.Navigator>
  );
}
