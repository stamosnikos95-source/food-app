import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import { theme } from "./theme";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { AuthGateScreen } from "./screens/AuthGateScreen";
import { TodayScreen } from "./screens/TodayScreen";
import { AssistantScreen } from "./screens/AssistantScreen";
import { OrdersScreen } from "./screens/OrdersScreen";
import { ProfileScreen } from "./screens/ProfileScreen";

const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.color.accent,
        tabBarInactiveTintColor: theme.color.textMuted,
        tabBarStyle: {
          backgroundColor: theme.color.surface,
          borderTopColor: theme.color.border,
        },
      }}
    >
      <Tab.Screen name="Σήμερα" component={TodayScreen} />
      <Tab.Screen name="Assistant" component={AssistantScreen} />
      <Tab.Screen name="Παραγγελίες" component={OrdersScreen} />
      <Tab.Screen name="Προφίλ" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { isLoading, accessToken } = useAuth();

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.color.background,
        }}
      >
        <ActivityIndicator color={theme.color.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer>{accessToken ? <MainTabs /> : <AuthGateScreen />}</NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </AuthProvider>
  );
}
