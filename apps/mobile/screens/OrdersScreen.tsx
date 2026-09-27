import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../auth/AuthContext";
import { useCart } from "../cart/CartContext";
import { Allowance, api, ApiError, LoyaltySummary, MySubscription, Order } from "../api/client";
import { useGym } from "../gym/GymContext";
import { describeError } from "../api/errors";
import { Screen } from "../components/Screen";
import { PrimaryButton } from "../components/PrimaryButton";
import { formatPrice, formatShortDateTime, upperGreek } from "../lib/format";
import { clearCheckoutReturn, peekCheckoutReturn } from "../checkout/checkoutReturn";
import { openCheckout } from "../checkout/openCheckout";
import { pickupCode } from "@food-app/shared-types";
import { theme } from "../theme";

const STATUS: Record<Order["status"], { label: string; tone: "neutral" | "active" | "done" | "muted" }> = {
  // Placed and unpaid: paid at pickup, unless the customer pays online first.
  pending: { label: "Σε αναμονή", tone: "neutral" },
  confirmed: { label: "Ετοιμάζεται", tone: "active" },
  ready: { label: "Έτοιμη για παραλαβή", tone: "active" },
  completed: { label: "Παραλήφθηκε", tone: "done" },
  cancelled: { label: "Ακυρώθηκε", tone: "muted" },
};

type Banner = { tone: "success" | "info" | "error"; title: string; message?: string };

type HistoryState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; orders: Order[] };

function DiscountLine({ label, cents }: { label: string; cents: number }) {
  return (
    <View style={styles.subsidyLine}>
      <Text style={styles.subsidyLabel}>{label}</Text>
      <Text style={styles.subsidyValue}>−{formatPrice(cents)}</Text>
    </View>
  );
}

function Toggle({ label, on, disabled, onPress }: { label: string; on: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled }}
      style={[styles.toggleRow, disabled && { opacity: 0.5 }]}
    >
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={[styles.toggle, on && styles.toggleOn]}>
        <View style={[styles.knob, on && styles.knobOn]} />
      </View>
    </Pressable>
  );
}

/** "Συνδρομή −8,50 € · Πόντοι −5,00 € · πλήρωσες 3,50 €" for past orders. */
function discountSummary(o: Order): string | null {
  const parts = [
    o.subscriptionCoveredCents > 0 ? `Συνδρομή −${formatPrice(o.subscriptionCoveredCents)}` : null,
    o.companyPaidCents > 0 ? `Εταιρεία −${formatPrice(o.companyPaidCents)}` : null,
    o.gymDiscountCents > 0 ? `Γυμναστήριο −${formatPrice(o.gymDiscountCents)}` : null,
    o.loyaltyDiscountCents > 0 ? `Πόντοι −${formatPrice(o.loyaltyDiscountCents)}` : null,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  const paid = o.totalPriceCents - o.companyPaidCents - o.subscriptionCoveredCents - o.gymDiscountCents - o.loyaltyDiscountCents;
  return `${parts.join(" · ")} · πλήρωσες ${formatPrice(paid)}`;
}

export function OrdersScreen() {
  const { withAuth } = useAuth();
  const cart = useCart();
  const [history, setHistory] = useState<HistoryState>({ status: "loading" });
  const [allowance, setAllowance] = useState<Allowance | null>(null);
  const [loyalty, setLoyalty] = useState<LoyaltySummary | null>(null);
  const [plan, setPlan] = useState<MySubscription | null>(null);
  const [usePlan, setUsePlan] = useState(true);
  const [redeem, setRedeem] = useState(false);
  const { gym, clear: clearGym } = useGym();
  const [deliverToGym, setDeliverToGym] = useState(false);
  const [placing, setPlacing] = useState<"card" | "store" | null>(null);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [paymentsEnabled, setPaymentsEnabled] = useState<boolean | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);

  const loadOrders = useCallback(() => {
    withAuth((token) => api.getMyAllowance(token))
      .then((r) => setAllowance(r.allowance))
      .catch(() => setAllowance(null));
    withAuth((token) => api.getLoyalty(token)).then(setLoyalty).catch(() => setLoyalty(null));
    withAuth((token) => api.getMySubscription(token))
      .then((r) => setPlan(r.subscription))
      .catch(() => setPlan(null));
    withAuth((token) => api.getOrders(token))
      .then((orders) => setHistory({ status: "ready", orders }))
      .catch((error) => setHistory({ status: "error", message: describeError(error) }));
  }, [withAuth]);

  // Runs on first focus and every time the tab is revisited, so an order
  // placed a moment ago is always listed.
  useFocusEffect(loadOrders);

  useEffect(() => {
    api
      .getPaymentsConfig()
      .then((config) => setPaymentsEnabled(config.onlinePaymentsEnabled))
      .catch(() => setPaymentsEnabled(false));
  }, []);

  // Back from the hosted payment page: verify with the server, show the outcome.
  useEffect(() => {
    const returned = peekCheckoutReturn();
    if (!returned) return;
    clearCheckoutReturn();

    if (returned.outcome === "cancelled") {
      setBanner({
        tone: "info",
        title: "Η πληρωμή ακυρώθηκε",
        message: "Η παραγγελία σου περιμένει στο ιστορικό — μπορείς να την πληρώσεις όποτε θες.",
      });
      return;
    }
    setBanner({ tone: "info", title: "Επιβεβαιώνουμε την πληρωμή…" });
    withAuth((token) => api.confirmCheckout(token, returned.sessionId))
      .then((order) =>
        setBanner(
          order.status === "pending"
            ? {
                tone: "info",
                title: "Η πληρωμή επεξεργάζεται",
                message: "Θα ενημερωθεί εδώ μόλις ολοκληρωθεί.",
              }
            : {
                tone: "success",
                title: "Η παραγγελία σου επιβεβαιώθηκε",
                message: "Η πληρωμή ολοκληρώθηκε. Θα σε περιμένει στο κατάστημα.",
              },
        ),
      )
      .catch((error) =>
        setBanner({ tone: "error", title: "Δεν επιβεβαιώθηκε ακόμα", message: describeError(error) }),
      )
      .finally(loadOrders);
  }, [withAuth, loadOrders]);

  async function goToPayment(orderId: string) {
    const { checkoutUrl } = await withAuth((token) => api.startCheckout(token, orderId));
    await openCheckout(checkoutUrl);
  }

  const paymentErrors = {
    503: "Η πληρωμή δεν είναι διαθέσιμη αυτή τη στιγμή. Δοκίμασε ξανά σε λίγο.",
    409: "Αυτή η παραγγελία έχει ήδη πληρωθεί.",
  };

  async function placeOrderAndPay() {
    if (cart.lines.length === 0) return;
    setCheckoutError(null);
    setPlacing("card");
    let orderId: string | null = null;
    try {
      const items = cart.lines.map((l) => ({ menuItemId: l.item.id, quantity: l.quantity }));
      orderId = (await withAuth((token) => api.createOrder(token, items, orderOptions))).id;
      // The order now exists (awaiting payment), so the cart has done its job;
      // if payment can't start, it can be retried from the history below.
      cart.clear();
      await goToPayment(orderId);
    } catch (error) {
      if (error instanceof ApiError && /gym/i.test(error.message)) {
        clearGym();
        setCheckoutError("Ο κωδικός του γυμναστηρίου δεν ισχύει πια — η παραγγελία μπορεί να γίνει κανονικά, χωρίς την έκπτωση.");
        return;
      }
      setCheckoutError(
        describeError(error, {
          400: "Κάποιο πιάτο δεν είναι πια διαθέσιμο. Αφαίρεσέ το και δοκίμασε ξανά.",
          ...paymentErrors,
        }),
      );
      if (orderId) loadOrders();
      setPlacing(null);
    }
  }

  /** Pay-at-pickup order: always available, with or without online payments. */
  async function placeOrderPayAtStore() {
    if (cart.lines.length === 0) return;
    setCheckoutError(null);
    setPlacing("store");
    try {
      const items = cart.lines.map((l) => ({ menuItemId: l.item.id, quantity: l.quantity }));
      await withAuth((token) => api.createOrder(token, items, orderOptions));
      cart.clear();
      setBanner({
        tone: "success",
        title: "Η παραγγελία στάλθηκε",
        message: orderOptions.fulfillment === "gym" && gym ? `Θα παραδοθεί στο ${gym.name}${gym.deliveryNote ? ` (${gym.deliveryNote})` : ""}. Πληρωμή κατά την παράδοση.` : "Θα πληρώσεις κατά την παραλαβή από το κατάστημα.",
      });
      loadOrders();
    } catch (error) {
      if (error instanceof ApiError && /gym/i.test(error.message)) {
        clearGym();
        setCheckoutError("Ο κωδικός του γυμναστηρίου δεν ισχύει πια — η παραγγελία μπορεί να γίνει κανονικά, χωρίς την έκπτωση.");
        return;
      }
      setCheckoutError(
        describeError(error, {
          400: "Κάποιο πιάτο δεν είναι πια διαθέσιμο. Αφαίρεσέ το και δοκίμασε ξανά.",
        }),
      );
    } finally {
      setPlacing(null);
    }
  }

  async function payExistingOrder(orderId: string) {
    setPayingOrderId(orderId);
    try {
      await goToPayment(orderId);
    } catch (error) {
      setBanner({ tone: "error", title: "Η πληρωμή δεν ξεκίνησε", message: describeError(error, paymentErrors) });
      setPayingOrderId(null);
      loadOrders();
    }
  }

  // Preview only — the server re-prices everything, in the same order:
  // meal plan (most expensive portions first), employer subsidy, loyalty.
  const portions = cart.lines.flatMap((l) => Array<number>(l.quantity).fill(l.item.priceCents)).sort((a, b) => b - a);
  const planMeals = plan?.usable && usePlan ? Math.min(plan.mealsRemaining, portions.length) : 0;
  const planCents = portions.slice(0, planMeals).reduce((sum, p) => sum + Math.min(p, plan?.plan.maxMealPriceCents ?? 0), 0);
  const afterPlan = cart.totalCents - planCents;
  const subsidy = allowance ? Math.min(allowance.remainingTodayCents, afterPlan) : 0;
  const afterSubsidy = afterPlan - subsidy;
  const gymCents = gym ? Math.floor((afterSubsidy * gym.discountPercent) / 100) : 0;
  const afterGym = afterSubsidy - gymCents;
  const canRedeem = Boolean(loyalty?.canRedeem) && afterGym > 0;
  const loyaltyCents = redeem && canRedeem && loyalty ? Math.min(loyalty.rewardValueCents, afterGym) : 0;
  const amountDue = afterGym - loyaltyCents;
  const orderOptions = {
    subscriptionMeals: planMeals || undefined,
    redeemPoints: loyaltyCents > 0 || undefined,
    gymCode: gym?.code,
    fulfillment: gym?.deliveryEnabled && deliverToGym ? ("gym" as const) : ("store" as const),
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title} accessibilityRole="header">
          Παραγγελίες
        </Text>

        {banner ? (
          <View style={[styles.banner, bannerTone[banner.tone]]} accessibilityRole="alert">
            <Text style={styles.bannerTitle}>{banner.title}</Text>
            {banner.message ? <Text style={styles.bannerMessage}>{banner.message}</Text> : null}
          </View>
        ) : null}

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
            {plan?.usable && plan.mealsRemaining > 0 ? (
              <Toggle
                label={`Χρήση συνδρομής · ${plan.mealsRemaining === 1 ? "απομένει 1 γεύμα" : `απομένουν ${plan.mealsRemaining} γεύματα`}`}
                on={usePlan}
                onPress={() => setUsePlan((v) => !v)}
              />
            ) : null}
            {loyalty?.canRedeem ? (
              <Toggle
                label={`Εξαργύρωση ${loyalty.rewardPoints} πόντων (−${formatPrice(loyalty.rewardValueCents)})`}
                on={redeem && canRedeem}
                disabled={!canRedeem}
                onPress={() => setRedeem((v) => !v)}
              />
            ) : null}
            {planCents > 0 ? (
              <DiscountLine label={`Συνδρομή · ${planMeals} ${planMeals === 1 ? "γεύμα" : "γεύματα"}`} cents={planCents} />
            ) : null}
            {subsidy > 0 && allowance ? <DiscountLine label={`Επιδότηση ${allowance.companyName}`} cents={subsidy} /> : null}
            {gymCents > 0 && gym ? <DiscountLine label={`Μέλος ${gym.name} (−${gym.discountPercent}%)`} cents={gymCents} /> : null}
            {loyaltyCents > 0 && loyalty ? <DiscountLine label={`Πόντοι (${loyalty.rewardPoints})`} cents={loyaltyCents} /> : null}
            {gym?.deliveryEnabled ? (
              <Toggle
                label={`Παράδοση στο ${gym.name}${gym.deliveryNote ? ` · ${gym.deliveryNote}` : ""}`}
                on={deliverToGym}
                onPress={() => setDeliverToGym((v) => !v)}
              />
            ) : null}
            {amountDue !== cart.totalCents ? (
              <View style={styles.subsidyLine}>
                <Text style={styles.totalLabel}>Πληρώνεις</Text>
                <Text style={styles.totalLabel}>{formatPrice(amountDue)}</Text>
              </View>
            ) : null}
            <Text style={styles.pickupNote}>
              {orderOptions.fulfillment === "gym" && gym
                ? `Παράδοση στο ${gym.name}${gym.deliveryNote ? ` (${gym.deliveryNote})` : ""} · ${paymentsEnabled ? "πλήρωσε τώρα με κάρτα ή κατά την παράδοση" : "πληρωμή κατά την παράδοση"}`
                : paymentsEnabled
                  ? "Παραλαβή από το κατάστημα · πλήρωσε τώρα με κάρτα ή κατά την παραλαβή"
                  : "Παραλαβή από το κατάστημα · πληρωμή κατά την παραλαβή"}
            </Text>
            {checkoutError ? <Text style={styles.error}>{checkoutError}</Text> : null}
            {/* Ordering never depends on online payments being configured:
                without them (or while their status loads) pay-at-store is the
                primary action; with them, card is primary and store secondary. */}
            {paymentsEnabled && amountDue >= MIN_CARD_CHARGE_CENTS ? (
              <>
                <PrimaryButton
                  title={`Πληρωμή με κάρτα · ${formatPrice(amountDue)}`}
                  onPress={placeOrderAndPay}
                  loading={placing === "card"}
                  disabled={placing !== null}
                />
                <View style={styles.secondaryAction}>
                  <PrimaryButton
                    title={orderOptions.fulfillment === "gym" ? "Πληρωμή κατά την παράδοση" : "Πληρωμή στο κατάστημα"}
                    onPress={placeOrderPayAtStore}
                    loading={placing === "store"}
                    disabled={placing !== null}
                    variant="secondary"
                  />
                </View>
              </>
            ) : (
              <PrimaryButton
                title="Ολοκλήρωση παραγγελίας"
                onPress={placeOrderPayAtStore}
                loading={placing === "store"}
                disabled={placing !== null}
              />
            )}
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
                  <Text style={styles.orderDate}>
                    {formatShortDateTime(order.createdAt)} · #{pickupCode(order.id)}
                  </Text>
                  <View style={[styles.chip, chipTone[status.tone]]}>
                    <Text style={[styles.chipText, chipTextTone[status.tone]]}>{status.label}</Text>
                  </View>
                </View>
                <Text style={styles.orderItems}>
                  {order.items.map((l) => `${l.quantity}× ${l.menuItem.name}`).join(" · ")}
                </Text>
                <View style={styles.orderFooter}>
                  <Text style={styles.orderTotal}>{formatPrice(order.totalPriceCents)}</Text>
                  {discountSummary(order) ? <Text style={styles.companyPaid}>{discountSummary(order)}</Text> : null}
                  {order.status === "pending" && paymentsEnabled ? (
                    <Pressable
                      onPress={() => payExistingOrder(order.id)}
                      disabled={payingOrderId !== null}
                      accessibilityRole="button"
                      accessibilityLabel={`Πληρωμή παραγγελίας ${formatPrice(order.totalPriceCents)}`}
                      style={({ pressed }) => [styles.payLink, pressed && { opacity: 0.6 }]}
                    >
                      {payingOrderId === order.id ? (
                        <ActivityIndicator color={theme.color.accentStrong} size="small" />
                      ) : (
                        <Text style={styles.payLinkText}>Πληρωμή →</Text>
                      )}
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const MIN_CARD_CHARGE_CENTS = 50; // the card processor's minimum charge

const styles = StyleSheet.create({
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 10 },
  toggleLabel: { flex: 1, fontFamily: theme.typography.fontBody, fontSize: theme.typography.scale.sm, color: theme.color.textPrimary },
  toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: theme.color.border, padding: 3 },
  toggleOn: { backgroundColor: theme.color.accent },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: theme.color.surface },
  knobOn: { transform: [{ translateX: 18 }] },
  secondaryAction: { marginTop: theme.space.sm },
  subsidyLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: theme.space.xs },
  subsidyLabel: { fontFamily: theme.typography.fontBody, fontSize: theme.typography.scale.sm, color: theme.color.accentStrong },
  subsidyValue: { fontFamily: theme.typography.fontBodyMedium, fontSize: theme.typography.scale.sm, color: theme.color.accentStrong },
  companyPaid: { fontFamily: theme.typography.fontBody, fontSize: 13, color: theme.color.accentStrong, marginTop: 2 },
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
  orderFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: theme.space.xs,
  },
  orderTotal: {
    fontFamily: theme.typography.fontBodyMedium,
    fontSize: theme.typography.scale.sm,
    color: theme.color.textSecondary,
  },
  payLink: {
    minHeight: 36,
    minWidth: 88,
    paddingHorizontal: theme.space.sm,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  payLinkText: {
    fontFamily: theme.typography.fontBodySemiBold,
    fontSize: theme.typography.scale.sm,
    color: theme.color.accentStrong,
  },
  banner: {
    borderRadius: theme.radius.lg,
    padding: theme.space.md,
    marginBottom: theme.space.lg,
    borderWidth: 1,
  },
  bannerTitle: {
    fontFamily: theme.typography.fontBodySemiBold,
    fontSize: theme.typography.scale.base,
    color: theme.color.textPrimary,
  },
  bannerMessage: {
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.sm,
    lineHeight: 20,
    color: theme.color.textSecondary,
    marginTop: 4,
  },
  error: {
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.sm,
    lineHeight: 20,
    color: theme.color.danger,
    marginBottom: theme.space.md,
  },
});

const bannerTone = StyleSheet.create({
  success: { backgroundColor: theme.color.accentSoft, borderColor: theme.color.accent },
  info: { backgroundColor: theme.color.surfaceRaised, borderColor: theme.color.border },
  error: { backgroundColor: theme.color.surfaceRaised, borderColor: theme.color.danger },
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
