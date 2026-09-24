import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../auth/AuthContext";
import { HomeScreen } from "../screens/HomeScreen";
import { HubScreen } from "../screens/HubScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { VozidlaNavigator } from "../screens/vozidla/VozidlaNavigator";
import { colors } from "../theme";

export type RootStackParamList = {
  Login: undefined;
  Hub: undefined;
  Home: undefined;
  Vozidla: undefined;
};

const AuthStack = createNativeStackNavigator<Pick<RootStackParamList, "Login">>();
const AppStack = createNativeStackNavigator<
  Omit<RootStackParamList, "Login">
>();

export function RootNavigator() {
  const { ready, user } = useAuth();

  if (!ready) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer key={user ? "app" : "auth"}>
      {user ? (
        <AppStack.Navigator
          initialRouteName="Hub"
          screenOptions={{ headerShown: false }}
        >
          <AppStack.Screen name="Hub" component={HubScreen} />
          <AppStack.Screen name="Home" component={HomeScreen} />
          <AppStack.Screen name="Vozidla" component={VozidlaNavigator} />
        </AppStack.Navigator>
      ) : (
        <AuthStack.Navigator
          initialRouteName="Login"
          screenOptions={{ headerShown: false }}
        >
          <AuthStack.Screen name="Login" component={LoginScreen} />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
});
