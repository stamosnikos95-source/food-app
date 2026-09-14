import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import { theme } from "./theme";
import { TodayScreen } from "./screens/TodayScreen";
import { AssistantScreen } from "./screens/AssistantScreen";
import { OrdersScreen } from "./screens/OrdersScreen";
import { ProfileScreen } from "./screens/ProfileScreen";

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="dark" />
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
    </NavigationContainer>
  );
}
