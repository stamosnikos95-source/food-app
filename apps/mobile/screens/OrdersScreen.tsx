import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../auth/AuthContext";
import { useCart } from "../cart/CartContext";
import { api, Order } from "../api/client";
import { describeError } from "../api/errors";
import { Screen } from "../components/Screen";
import { PrimaryButton } from "../components/PrimaryButton";
import { formatPrice, formatShortDateTime, upperGreek } from "../lib/format";
import { theme } from "../theme";

const STATUS: Record<Order["status"], { label: string; tone: "neutral" | "active" | "done" | "muted" }> = {
  pending: { label: "Σε αναμονή", tone: "neutral" },
  confirmed: { label: "Ετοιμάζεται", tone: "active" },
  ready: { label: "Έτοιμη για παραλαβή", tone: "active" },
  completed: { label: "Παραλήφθηκε", tone: "done" },
  cancelled: { label: "Ακυρώθηκε", tone: "muted" },
};

type HistoryState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; orders: Order[] };

export function OrdersScreen() {
  const { withAuth } = useAuth();
  const cart = useCart();
  const [history, setHistory] = useState<HistoryState>({ status: "loading" });
  const [placing, setPlacing] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const loadOrders = useCallback(() => {
    withAuth((token) => api.getOrders(token))
      .then((orders) => setHistory({ status: "ready", orders }))
      .catch((error) => setHistory({ status: "error", message: describeError(error) }));
  }, [withAuth]);

  // Runs on first focus and every time the tab is revisited, so an order
  // placed a moment ago is always listed.
  useFocusEffect(loadOrders);

  async function placeOrder() {
    if (cart.lines.length === 0) return;
    setCheckoutError(null);
    setPlacing(true);
    try {
      const items = cart.lines.map((l) => ({ menuItemId: l.item.id, quantity: l.quantity }));
      await withAuth((token) => api.createOrder(token, items));
      cart.clear();
      loadOrders();
    } catch (error) {
      setCheckoutError(
        describeError(error, {
          400: "Κάποιο πιάτο δεν είναι πια διαθέσιμο. Αφαίρεσέ το και δοκίμασε ξανά.",
        }),
      );
    } finally {
      setPlacing(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title} accessibilityRole="header">
          Παραγγελίες
        </Text>

        {cart.lines.length > 0 ? (
          <View style={styles.cartCard}>
            <Text style={styles.sectionLabel}>{upperGreek("Το καλάθι σου")}</Text>
            {cart.lines.map((line) => (
              <View key={line.item.id} style={styles.cartLine}>
                <Text style={styles.cartQty}>{line.quantity}×</Text>
                <Text style={styles.cartName}>{line.item.name}</Text>
                <Text style={styles.cartPrice}>
                  {formatPrice(line.item.priceCents * line.quantity)}
                </Text>
              </View>
            ))}
            <View style={styles.totalLine}>
              <Text style={styles.totalLabel}>Σύνολο</Text>
              <Text style={styles.totalValue}>{formatPrice(cart.totalCents)}</Text>
            </View>
            <Text style={styles.pickupNote}>
              Παραλαβή από το κατάστημα · πληρωμή κατά την παραλαβή
            </Text>
            {checkoutError ? <Text style={styles.error}>{checkoutError}</Text> : null}
            <PrimaryButton title="Ολοκλήρωση παραγγελίας" onPress={placeOrder} loading={placing} />
          </View>
        ) : null}

        <Text style={[styles.sectionLabel, styles.historyLabel]}>{upperGreek("Ιστορικό")}</Text>

        {history.status === "loading" ? (
          <ActivityIndicator color={theme.color.accent} style={styles.spinner} />
        ) : history.status === "error" ? (
          <View>
            <Text style={styles.error}>{history.message}</Text>
            <PrimaryButton title="Δοκίμασε ξανά" onPress={loadOrders} variant="secondary" />
          </View>
        ) : history.orders.length === 0 ? (
          <Text style={styles.empty}>
            Δεν έχεις κάνει ακόμα παραγγελία. Διάλεξε κάτι από το μενού της ημέρας.
          </Text>
        ) : (
          history.orders.map((order) => {
            const status = STATUS[order.status];
            return (
              <View key={order.id} style={styles.orderRow}>
                <View style={styles.orderHeader}>
                  <Text style={styles.orderDate}>{formatShortDateTime(order.createdAt)}</Text>
                  <View style={[styles.chip, chipTone[status.tone]]}>
                    <Text style={[styles.chipText, chipTextTone[status.tone]]}>{status.label}</Text>
                  </View>
                </View>
                <Text style={styles.orderItems}>
                  {order.items.map((l) => `${l.quantity}× ${l.menuItem.name}`).join(" · ")}
                </Text>
                <Text style={styles.orderTotal}>{formatPrice(order.totalPriceCents)}</Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.space.lg,
    paddingTop: theme.space.xl,
    paddingBottom: theme.space["2xl"],
  },
  title: {
    fontFamily: theme.typography.fontDisplay,
    fontSize: theme.typography.scale["2xl"],
    lineHeight: 38,
    color: theme.color.textPrimary,
    marginBottom: theme.space.lg,
  },
  sectionLabel: {
    fontFamily: theme.typography.fontBodyMedium,
    fontSize: theme.typography.scale.xs,
    letterSpacing: 1.2,
    color: theme.color.textMuted,
    marginBottom: theme.space.sm,
  },
  historyLabel: { marginTop: theme.space.sm },
  cartCard: {
    backgroundColor: theme.color.surfaceRaised,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.color.border,
    padding: theme.space.md,
    marginBottom: theme.space.lg,
  },
  cartLine: {
    flexDirection: "row",
    alignItems: "baseline",
    paddingVertical: 6,
  },
  cartQty: {
    width: 28,
    fontFamily: theme.typography.fontBodyMedium,
    fontSize: theme.typography.scale.sm,
    color: theme.color.textSecondary,
  },
  cartName: {
    flex: 1,
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.base,
    color: theme.color.textPrimary,
  },
  cartPrice: {
    fontFamily: theme.typography.fontBodyMedium,
    fontSize: theme.typography.scale.base,
    color: theme.color.textPrimary,
  },
  totalLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
    marginTop: theme.space.sm,
    paddingTop: theme.space.sm,
  },
  totalLabel: {
    fontFamily: theme.typography.fontBodySemiBold,
    fontSize: theme.typography.scale.base,
    color: theme.color.textPrimary,
  },
  totalValue: {
    fontFamily: theme.typography.fontDisplay,
    fontSize: theme.typography.scale.xl,
    color: theme.color.accentStrong,
  },
  pickupNote: {
    fontFamily: theme.typography.fontBody,
    fontSize: 13,
    color: theme.color.textMuted,
    marginTop: theme.space.xs,
    marginBottom: theme.space.md,
  },
  spinner: { marginTop: theme.space.md },
  empty: {
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.base,
    lineHeight: 23,
    color: theme.color.textSecondary,
  },
  orderRow: {
    paddingVertical: theme.space.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderDate: {
    fontFamily: theme.typography.fontBodyMedium,
    fontSize: theme.typography.scale.sm,
    color: theme.color.textSecondary,
  },
  chip: {
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  chipText: {
    fontFamily: theme.typography.fontBodyMedium,
    fontSize: theme.typography.scale.xs,
  },
  orderItems: {
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.base,
    lineHeight: 22,
    color: theme.color.textPrimary,
    marginTop: theme.space.xs,
  },
  orderTotal: {
    fontFamily: theme.typography.fontBodyMedium,
    fontSize: theme.typography.scale.sm,
    color: theme.color.textSecondary,
    marginTop: theme.space.xs,
  },
  error: {
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.sm,
    lineHeight: 20,
    color: theme.color.danger,
    marginBottom: theme.space.md,
  },
});

const chipTone = StyleSheet.create({
  neutral: { backgroundColor: theme.color.border },
  active: { backgroundColor: theme.color.accentSoft },
  done: { backgroundColor: "transparent", borderWidth: 1, borderColor: theme.color.border },
  muted: { backgroundColor: "transparent", borderWidth: 1, borderColor: theme.color.border },
});

const chipTextTone = StyleSheet.create({
  neutral: { color: theme.color.textSecondary },
  active: { color: theme.color.accentStrong },
  done: { color: theme.color.textSecondary },
  muted: { color: theme.color.textMuted },
});
