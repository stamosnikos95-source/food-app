import { ActivityIndicator, Platform, StyleSheet, View } from "react-native";
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
import { GymProvider } from "./gym/GymContext";
import { DishSheetProvider } from "./dish/DishSheet";

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
        tabBarActiveTintColor: theme.color.accent,
        tabBarInactiveTintColor: theme.color.textMuted,
        tabBarLabelStyle: { fontFamily: theme.typography.fontBodyMedium, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: theme.color.surface,
          borderTopColor: theme.color.border,
        },
        tabBarIcon: ({ color }) => <Icon name={TAB_ICONS[route.name]} color={color} size={24} />,
      })}
    >
      <Tab.Screen name="Σήμερα" component={TodayScreen} options={{ tabBarLabel: "Μενού" }} />
      <Tab.Screen name="Βοηθός" component={AssistantScreen} options={{ tabBarLabel: "Για σένα" }} />
      <Tab.Screen
        name="Παραγγελίες"
        component={OrdersScreen}
        options={{
          tabBarLabel: "Καλάθι",
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
          <DishSheetProvider>
          <MainTabs />
          </DishSheetProvider>
        </CartProvider>
      ) : (
        <AuthGateScreen />
      )}
    </NavigationContainer>
  );
}

// Web: the design is light-only. Opt out of browsers' automatic dark mode
// (Chrome/Brave "force dark"), which recolours it unpredictably, and paint
// the page around the centred app column.
const WEB_PAGE_BACKGROUND = "#EEF1EE";
if (Platform.OS === "web" && typeof document !== "undefined") {
  const meta =
    document.querySelector('meta[name="color-scheme"]') ??
    document.head.appendChild(Object.assign(document.createElement("meta"), { name: "color-scheme" }));
  meta.setAttribute("content", "only light");
  document.documentElement.style.colorScheme = "only light";
  document.body.style.backgroundColor = WEB_PAGE_BACKGROUND;
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
      <View style={styles.frame}>
        <AuthProvider>
          <GymProvider>
            <StatusBar style="dark" />
            <RootNavigator />
          </GymProvider>
        </AuthProvider>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  // Phones: full screen. Wide screens (desktop web): a centred, phone-width
  // column, so photos, cards and buttons keep their designed proportions.
  frame: Platform.select({
    web: {
      flex: 1,
      width: "100%",
      maxWidth: 560,
      alignSelf: "center",
      backgroundColor: theme.color.background,
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 0 },
    },
    default: { flex: 1 },
  }),
});
