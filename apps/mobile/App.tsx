import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { theme } from "./theme";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { CartProvider } from "./cart/CartContext";
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
    <NavigationContainer>
      {accessToken ? (
        <CartProvider>
          <MainTabs />
        </CartProvider>
      ) : (
        <AuthGateScreen />
      )}
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    // Requiring the specific .ttf directly (instead of importing the named
    // export from the package index) avoids Metro bundling all ~18 weights
    // the package ships — we only ever use these three.
    Fraunces_600SemiBold: require("@expo-google-fonts/fraunces/Fraunces_600SemiBold.ttf"),
    WorkSans_400Regular: require("@expo-google-fonts/work-sans/WorkSans_400Regular.ttf"),
    WorkSans_500Medium: require("@expo-google-fonts/work-sans/WorkSans_500Medium.ttf"),
  });

  if (!fontsLoaded) {
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
    <AuthProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </AuthProvider>
  );
}
