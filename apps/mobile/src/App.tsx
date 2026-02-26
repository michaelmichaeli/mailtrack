import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { DashboardScreen } from "./screens/DashboardScreen";
import { PackagesScreen } from "./screens/PackagesScreen";
import { PackageDetailScreen } from "./screens/PackageDetailScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { LoginScreen } from "./screens/LoginScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60 * 1000 } },
});

function PackagesStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="PackagesList" component={PackagesScreen} options={{ title: "Packages" }} />
      <Stack.Screen name="PackageDetail" component={PackageDetailScreen} options={{ title: "Package Details" }} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: "#3b82f6",
        tabBarInactiveTintColor: "#9CA3AF",
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ tabBarLabel: "Home" }}
      />
      <Tab.Screen
        name="Packages"
        component={PackagesStack}
        options={{ tabBarLabel: "Packages", headerShown: false }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarLabel: "Settings" }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const isAuthenticated = true; // TODO: Replace with actual auth state

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <NavigationContainer>
          {isAuthenticated ? <MainTabs /> : <LoginScreen />}
        </NavigationContainer>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
