import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { Rezervacia } from "../../api/rezervacieFields";
import { NovaRezervaciaScreen } from "./NovaRezervaciaScreen";
import { UpravitRezervaciuScreen } from "./UpravitRezervaciuScreen";
import { VozidlaHomeScreen } from "./VozidlaHomeScreen";

export type VozidlaStackParamList = {
  VozidlaHome: undefined;
  NovaRezervacia: undefined;
  UpravitRezervaciu: { rezervacia: Rezervacia };
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
    </Stack.Navigator>
  );
}
