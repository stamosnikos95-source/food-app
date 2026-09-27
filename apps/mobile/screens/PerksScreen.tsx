import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../auth/AuthContext";
import { api, LoyaltySummary, MySubscription, Plan } from "../api/client";
import { describeError } from "../api/errors";
import { Screen } from "../components/Screen";
import { PrimaryButton } from "../components/PrimaryButton";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { formatPrice, upperGreek } from "../lib/format";
import { theme } from "../theme";

const ENTRY_LABEL = { earn: "Κέρδισες", redeem: "Εξαργύρωση", reversal: "Επιστροφή", adjustment: "Διόρθωση" } as const;
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("el-GR", { day: "numeric", month: "short" });

/** Loyalty points and meal plans. */
export function PerksScreen() {
  const { withAuth } = useAuth();
  const [loyalty, setLoyalty] = useState<LoyaltySummary | null>(null);
  const [subscription, setSubscription] = useState<MySubscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([
      withAuth((t) => api.getLoyalty(t)),
      withAuth((t) => api.getMySubscription(t)),
      withAuth((t) => api.getPlans(t)),
    ])
      .then(([l, s, p]) => {
        setLoyalty(l);
        setSubscription(s.subscription);
        setPlans(p);
        setError(null);
      })
      .catch((e) => setError(describeError(e)));
  }, [withAuth]);
  useFocusEffect(load);

  async function choose(planId: string) {
    setBusy(planId);
    setError(null);
    try {
      await withAuth((t) => api.requestPlan(t, planId));
      load();
    } catch (e) {
      setError(describeError(e, { 409: "Έχεις ήδη ανοιχτή συνδρομή." }));
    } finally {
      setBusy(null);
    }
  }

  async function cancelRequest() {
    setBusy("cancel");
    try {
      await withAuth((t) => api.cancelPendingPlan(t));
      load();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(null);
    }
  }

  if (!loyalty && error) return <Screen><ErrorState title="Δεν φόρτωσαν τα προνόμια" message={error} onRetry={load} /></Screen>;
  if (!loyalty) return <Screen><LoadingState label="Φόρτωση…" /></Screen>;

  const progress = Math.min(1, loyalty.balance / loyalty.rewardPoints);
  const open = subscription && subscription.status !== "cancelled" ? subscription : null;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title} accessibilityRole="header">Προνόμια</Text>

        <View style={styles.card}>
          <Text style={styles.label}>{upperGreek("Οι πόντοι σου")}</Text>
          <Text style={styles.balance}>{loyalty.balance}</Text>
          <View style={styles.track} accessibilityLabel={`Πρόοδος: ${loyalty.balance} από ${loyalty.rewardPoints} πόντους`}>
            <View style={[styles.fill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.body}>
            {loyalty.canRedeem
              ? `Μπορείς να εξαργυρώσεις ${loyalty.rewardPoints} πόντους για ${formatPrice(loyalty.rewardValueCents)} έκπτωση, από το καλάθι.`
              : `Σου λείπουν ${loyalty.pointsToNextReward} πόντοι για ${formatPrice(loyalty.rewardValueCents)} έκπτωση.`}
          </Text>
          <Text style={styles.hint}>
            Κερδίζεις {loyalty.pointsPerEuro} {loyalty.pointsPerEuro === 1 ? "πόντο" : "πόντους"} για κάθε 1 € που πληρώνεις. Πιστώνονται όταν παραλάβεις την παραγγελία.
          </Text>
          {loyalty.history.slice(0, 4).map((h) => (
            <View key={h.id} style={styles.historyRow}>
              <Text style={styles.historyText}>{ENTRY_LABEL[h.type]} · {shortDate(h.createdAt)}</Text>
              <Text style={[styles.historyText, h.points > 0 && styles.plus]}>{h.points > 0 ? `+${h.points}` : h.points}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.section}>{upperGreek("Συνδρομή γευμάτων")}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {open?.status === "active" && open.usable ? (
          <View style={styles.card}>
            <Text style={styles.planName}>{open.plan.name}</Text>
            <Text style={styles.big}>{open.mealsRemaining}<Text style={styles.bigOf}> / {open.plan.mealsPerPeriod} γεύματα</Text></Text>
            <Text style={styles.body}>Ισχύει έως {shortDate(open.currentPeriodEnd!)}. Κάθε γεύμα καλύπτει πιάτο έως {formatPrice(open.plan.maxMealPriceCents)} — τα χρησιμοποιείς από το καλάθι.</Text>
          </View>
        ) : open?.status === "active" ? (
          <View style={styles.card}>
            <Text style={styles.planName}>{open.plan.name}</Text>
            <Text style={styles.body}>Η περίοδος έληξε. Για ανανέωση ({formatPrice(open.plan.priceCents)}), πλήρωσε στο κατάστημα.</Text>
          </View>
        ) : open?.status === "pending" ? (
          <View style={styles.card}>
            <Text style={styles.planName}>{open.plan.name} · {formatPrice(open.plan.priceCents)}</Text>
            <Text style={styles.body}>Η αίτησή σου καταχωρήθηκε. Πλήρωσε στο κατάστημα και η συνδρομή ενεργοποιείται αμέσως.</Text>
            <PrimaryButton title="Ακύρωση αίτησης" variant="secondary" loading={busy === "cancel"} onPress={cancelRequest} />
          </View>
        ) : plans.length === 0 ? (
          <Text style={styles.body}>Δεν υπάρχουν ακόμα διαθέσιμα πλάνα.</Text>
        ) : (
          plans.map((p) => (
            <View key={p.id} style={styles.card}>
              <Text style={styles.planName}>{p.name}</Text>
              <Text style={styles.body}>
                {p.mealsPerPeriod} γεύματα / {p.periodDays} ημέρες · {formatPrice(p.priceCents)} (≈ {formatPrice(Math.round(p.priceCents / p.mealsPerPeriod))} ανά γεύμα)
              </Text>
              <Text style={styles.hint}>Καλύπτει πιάτα έως {formatPrice(p.maxMealPriceCents)}. {p.description ?? ""}</Text>
              <PrimaryButton title="Επιλογή πλάνου" loading={busy === p.id} onPress={() => choose(p.id)} />
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: theme.space.lg, paddingTop: theme.space.xl, paddingBottom: theme.space["2xl"] },
  title: { fontFamily: theme.typography.fontDisplay, fontSize: theme.typography.scale["2xl"], lineHeight: 38, color: theme.color.textPrimary, marginBottom: theme.space.md },
  card: { backgroundColor: theme.color.surfaceRaised, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.color.border, padding: theme.space.md, marginBottom: theme.space.md, gap: theme.space.sm },
  label: { fontFamily: theme.typography.fontBodyMedium, fontSize: theme.typography.scale.xs, letterSpacing: 1.2, color: theme.color.textMuted },
  balance: { fontFamily: theme.typography.fontDisplay, fontSize: 44, lineHeight: 50, color: theme.color.textPrimary },
  track: { height: 8, borderRadius: 4, backgroundColor: theme.color.border, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4, backgroundColor: theme.color.accent },
  body: { fontFamily: theme.typography.fontBody, fontSize: theme.typography.scale.sm, lineHeight: 21, color: theme.color.textSecondary },
  hint: { fontFamily: theme.typography.fontBody, fontSize: 13, lineHeight: 19, color: theme.color.textMuted },
  historyRow: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: theme.color.border, paddingTop: 6 },
  historyText: { fontFamily: theme.typography.fontBody, fontSize: 13, color: theme.color.textSecondary },
  plus: { color: theme.color.accentStrong, fontFamily: theme.typography.fontBodyMedium },
  section: { fontFamily: theme.typography.fontBodyMedium, fontSize: theme.typography.scale.xs, letterSpacing: 1.2, color: theme.color.textMuted, marginTop: theme.space.md, marginBottom: theme.space.sm },
  planName: { fontFamily: theme.typography.fontDisplay, fontSize: theme.typography.scale.lg, color: theme.color.textPrimary },
  big: { fontFamily: theme.typography.fontDisplay, fontSize: 36, color: theme.color.accentStrong },
  bigOf: { fontFamily: theme.typography.fontBody, fontSize: theme.typography.scale.base, color: theme.color.textSecondary },
  error: { fontFamily: theme.typography.fontBody, fontSize: theme.typography.scale.sm, color: theme.color.danger, marginBottom: theme.space.sm },
});
