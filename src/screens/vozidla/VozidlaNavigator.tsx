import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { NovaRezervaciaScreen } from "./NovaRezervaciaScreen";
import { VozidlaHomeScreen } from "./VozidlaHomeScreen";

export type VozidlaStackParamList = {
  VozidlaHome: undefined;
  NovaRezervacia: undefined;
};

const Stack = createNativeStackNavigator<VozidlaStackParamList>();

export function VozidlaNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="VozidlaHome" component={VozidlaHomeScreen} />
      <Stack.Screen name="NovaRezervacia" component={NovaRezervaciaScreen} />
    </Stack.Navigator>
  );
}
