import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { useAuth, ApiError } from "../auth/AuthContext";
import { useCart } from "../cart/CartContext";
import { api, MenuItem } from "../api/client";
import { MenuItemCard } from "../components/MenuItemCard";
import { theme } from "../theme";

export function TodayScreen() {
  const { accessToken } = useAuth();
  const cart = useCart();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    api
      .getMenu(accessToken)
      .then(setItems)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Κάτι πήγε στραβά"))
      .finally(() => setLoading(false));
  }, [accessToken]);

  function quantityOf(menuItemId: string) {
    return cart.lines.find((l) => l.item.id === menuItemId)?.quantity ?? 0;
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.color.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.flex}
      contentContainerStyle={styles.container}
      data={items}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Σήμερα</Text>
          <Text style={styles.title}>Το μενού</Text>
          <Text style={styles.subtitle}>
            Ενδεικτικές διατροφικές τιμές — όχι διαιτολογική σύσταση.
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <MenuItemCard
          item={item}
          quantity={quantityOf(item.id)}
          onAdd={() => cart.add(item)}
          onRemove={() => cart.decrement(item.id)}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.color.background },
  container: { padding: theme.space.lg, paddingBottom: theme.space["2xl"] },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.color.background,
    padding: theme.space.lg,
  },
  header: { marginBottom: theme.space.lg },
  eyebrow: {
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.sm,
    color: theme.color.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontFamily: theme.typography.fontDisplay,
    fontSize: theme.typography.scale["2xl"],
    color: theme.color.textPrimary,
    marginTop: theme.space.xs,
  },
  subtitle: {
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.sm,
    color: theme.color.textMuted,
    marginTop: theme.space.xs,
  },
  error: {
    fontFamily: theme.typography.fontBody,
    color: theme.color.danger,
    textAlign: "center",
  },
});
