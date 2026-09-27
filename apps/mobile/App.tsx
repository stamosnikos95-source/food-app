import { ActivityIndicator, View } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { theme } from "./theme";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { CartProvider, useCart } from "./cart/CartContext";
import { Icon, IconName } from "./components/Icon";
import { peekCheckoutReturn } from "./checkout/checkoutReturn";
import { AuthGateScreen } from "./screens/AuthGateScreen";
import { TodayScreen } from "./screens/TodayScreen";
import { AssistantScreen } from "./screens/AssistantScreen";
import { OrdersScreen } from "./screens/OrdersScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { PerksScreen } from "./screens/PerksScreen";

const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, IconName> = {
  Σήμερα: "bowl",
  Βοηθός: "assistant",
  Παραγγελίες: "bag",
  Προνόμια: "gift",
  Προφίλ: "user",
};

const navigationTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: theme.color.background },
};

function MainTabs() {
  const cart = useCart();

  return (
    <Tab.Navigator
      // Back from the payment page: land on the orders tab to show the outcome.
      initialRouteName={peekCheckoutReturn() ? "Παραγγελίες" : "Σήμερα"}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.color.accentStrong,
        tabBarInactiveTintColor: theme.color.textMuted,
        tabBarLabelStyle: { fontFamily: theme.typography.fontBodyMedium, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: theme.color.surface,
          borderTopColor: theme.color.border,
        },
        tabBarIcon: ({ color }) => <Icon name={TAB_ICONS[route.name]} color={color} size={24} />,
      })}
    >
      <Tab.Screen name="Σήμερα" component={TodayScreen} />
      <Tab.Screen name="Βοηθός" component={AssistantScreen} />
      <Tab.Screen
        name="Παραγγελίες"
        component={OrdersScreen}
        options={{
          tabBarBadge: cart.totalCount > 0 ? cart.totalCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: theme.color.accent,
            color: theme.color.surface,
            fontFamily: theme.typography.fontBodySemiBold,
            fontSize: 11,
          },
        }}
      />
      <Tab.Screen name="Προνόμια" component={PerksScreen} />
      <Tab.Screen name="Προφίλ" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function Splash() {
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

function RootNavigator() {
  const { isLoading, isSignedIn } = useAuth();

  if (isLoading) return <Splash />;

  return (
    <NavigationContainer theme={navigationTheme}>
      {isSignedIn ? (
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
  const [fontsLoaded, fontError] = useFonts({
    // Vendored + subset to Latin/Greek; see assets/fonts/README.md.
    Piazzolla_600SemiBold: require("./assets/fonts/Piazzolla-SemiBold.ttf"),
    Commissioner_400Regular: require("./assets/fonts/Commissioner-Regular.ttf"),
    Commissioner_500Medium: require("./assets/fonts/Commissioner-Medium.ttf"),
    Commissioner_600SemiBold: require("./assets/fonts/Commissioner-SemiBold.ttf"),
  });

  // Never block the app on fonts: if they fail (slow network, blocked
  // request), render with system fonts rather than a spinner forever.
  if (!fontsLoaded && !fontError) return <Splash />;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
