import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth, ApiError } from "../auth/AuthContext";
import { useCart } from "../cart/CartContext";
import { api, Order } from "../api/client";
import { PrimaryButton } from "../components/PrimaryButton";
import { theme } from "../theme";

const STATUS_LABELS: Record<Order["status"], string> = {
  pending: "Σε αναμονή",
  confirmed: "Επιβεβαιώθηκε",
  ready: "Έτοιμη",
  completed: "Ολοκληρώθηκε",
  cancelled: "Ακυρώθηκε",
};

export function OrdersScreen() {
  const { accessToken } = useAuth();
  const cart = useCart();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(() => {
    if (!accessToken) return;
    setLoadingOrders(true);
    api
      .getOrders(accessToken)
      .then(setOrders)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Κάτι πήγε στραβά"))
      .finally(() => setLoadingOrders(false));
  }, [accessToken]);

  useEffect(loadOrders, [loadOrders]);
  // Re-fetch every time this tab regains focus, so a fresh order placed a
  // moment ago shows up without the user needing to pull-to-refresh.
  useFocusEffect(loadOrders);

  async function handleCheckout() {
    if (!accessToken || cart.lines.length === 0) return;
    setError(null);
    setPlacingOrder(true);
    try {
      await api.createOrder(
        accessToken,
        cart.lines.map((l) => ({ menuItemId: l.item.id, quantity: l.quantity })),
      );
      cart.clear();
      loadOrders();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Κάτι πήγε στραβά");
    } finally {
      setPlacingOrder(false);
    }
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Παραγγελίες</Text>

      {cart.lines.length > 0 && (
        <View style={styles.cartCard}>
          <Text style={styles.sectionTitle}>Το καλάθι σου</Text>
          {cart.lines.map((line) => (
            <View key={line.item.id} style={styles.cartRow}>
              <Text style={styles.cartRowText}>
                {line.quantity}× {line.item.name}
              </Text>
              <Text style={styles.cartRowText}>
                {((line.item.priceCents * line.quantity) / 100).toFixed(2)} €
              </Text>
            </View>
          ))}
          <View style={styles.cartTotalRow}>
            <Text style={styles.cartTotalLabel}>Σύνολο</Text>
            <Text style={styles.cartTotalValue}>{(cart.totalCents / 100).toFixed(2)} €</Text>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton
            title="Παραγγελία (παραλαβή από το κατάστημα)"
            onPress={handleCheckout}
            loading={placingOrder}
          />
        </View>
      )}

      <Text style={styles.sectionTitle}>Ιστορικό</Text>
      {loadingOrders ? (
        <ActivityIndicator color={theme.color.accent} />
      ) : orders.length === 0 ? (
        <Text style={styles.emptyText}>Δεν έχεις κάνει ακόμα καμία παραγγελία.</Text>
      ) : (
        orders.map((order) => (
          <View key={order.id} style={styles.orderCard}>
            <View style={styles.orderHeaderRow}>
              <Text style={styles.orderDate}>
                {new Date(order.createdAt).toLocaleDateString("el-GR", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
              <Text style={styles.orderStatus}>{STATUS_LABELS[order.status]}</Text>
            </View>
            {order.items.map((line) => (
              <Text key={line.id} style={styles.orderItemText}>
                {line.quantity}× {line.menuItem.name}
              </Text>
            ))}
            <Text style={styles.orderTotal}>{(order.totalPriceCents / 100).toFixed(2)} €</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.color.background },
  container: { padding: theme.space.lg, paddingBottom: theme.space["2xl"] },
  title: {
    fontFamily: theme.typography.fontDisplay,
    fontSize: theme.typography.scale["2xl"],
    color: theme.color.textPrimary,
    marginBottom: theme.space.lg,
  },
  sectionTitle: {
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.sm,
    fontWeight: "600",
    color: theme.color.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: theme.space.sm,
    marginTop: theme.space.md,
  },
  cartCard: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.color.border,
    padding: theme.space.md,
    marginBottom: theme.space.md,
  },
  cartRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.space.xs,
  },
  cartRowText: {
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.sm,
    color: theme.color.textPrimary,
  },
  cartTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
    paddingTop: theme.space.sm,
    marginTop: theme.space.xs,
    marginBottom: theme.space.md,
  },
  cartTotalLabel: {
    fontFamily: theme.typography.fontBody,
    fontWeight: "600",
    color: theme.color.textPrimary,
  },
  cartTotalValue: {
    fontFamily: theme.typography.fontBody,
    fontWeight: "600",
    color: theme.color.accentStrong,
  },
  emptyText: {
    fontFamily: theme.typography.fontBody,
    color: theme.color.textMuted,
  },
  orderCard: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.color.border,
    padding: theme.space.md,
    marginBottom: theme.space.sm,
  },
  orderHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.space.xs,
  },
  orderDate: {
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.sm,
    color: theme.color.textSecondary,
  },
  orderStatus: {
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.sm,
    color: theme.color.accentStrong,
    fontWeight: "600",
  },
  orderItemText: {
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.sm,
    color: theme.color.textPrimary,
  },
  orderTotal: {
    fontFamily: theme.typography.fontBody,
    fontWeight: "600",
    color: theme.color.textPrimary,
    marginTop: theme.space.xs,
  },
  error: {
    fontFamily: theme.typography.fontBody,
    color: theme.color.danger,
    marginBottom: theme.space.sm,
  },
});
