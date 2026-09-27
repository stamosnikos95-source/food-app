import { useCallback, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useAuth } from "../auth/AuthContext";
import { useCart } from "../cart/CartContext";
import { api, Recommendation } from "../api/client";
import { describeError } from "../api/errors";
import { Screen } from "../components/Screen";
import { MenuItemRow } from "../components/MenuItemRow";
import { CartBar } from "../components/CartBar";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { PrimaryButton } from "../components/PrimaryButton";
import { AssistantChat } from "../components/AssistantChat";
import { upperGreek } from "../lib/format";
import { theme } from "../theme";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: Recommendation };

/** "Τι να φάω σήμερα;" — today's menu ranked for this customer, with reasons. */
export function AssistantScreen() {
  const { withAuth } = useAuth();
  const cart = useCart();
  const navigation = useNavigation();
  const [state, setState] = useState<State>({ status: "loading" });
  const loadedOnce = useRef(false);

  // Re-rank every time the tab is opened: a profile edit changes the answer.
  const load = useCallback(() => {
    if (!loadedOnce.current) setState({ status: "loading" });
    withAuth((token) => api.getRecommendations(token))
      .then((data) => {
        loadedOnce.current = true;
        setState({ status: "ready", data });
      })
      .catch((error) => {
        if (!loadedOnce.current) setState({ status: "error", message: describeError(error) });
      });
  }, [withAuth]);
  useFocusEffect(load);

  const quantityOf = (id: string) => cart.lines.find((l) => l.item.id === id)?.quantity ?? 0;

  if (state.status === "loading") {
    return (
      <Screen>
        <LoadingState label="Διαλέγω πιάτα για σένα…" />
      </Screen>
    );
  }
  if (state.status === "error") {
    return (
      <Screen>
        <ErrorState title="Δεν βγήκαν προτάσεις" message={state.message} onRetry={load} />
      </Screen>
    );
  }

  const { data } = state;
  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.container, cart.totalCount > 0 && styles.aboveCartBar]}>
        <Text style={styles.eyebrow}>{upperGreek("Προτάσεις για σένα")}</Text>
        <Text style={styles.title} accessibilityRole="header">
          Τι να φάω σήμερα;
        </Text>
        {data.mealTargetKcal ? (
          <Text style={styles.subtitle}>
            Ενδεικτικός στόχος για ένα κύριο γεύμα: περίπου {data.mealTargetKcal} kcal.
          </Text>
        ) : null}

        <AssistantChat />

        {!data.profileComplete ? (
          <View style={styles.promptCard}>
            <Text style={styles.promptTitle}>Κάνε τις προτάσεις πιο προσωπικές</Text>
            <Text style={styles.promptText}>
              Με ηλικία, ύψος, βάρος και δραστηριότητα υπολογίζεται ένας ενδεικτικός στόχος θερμίδων.
              Αλλεργίες, διατροφή και budget λαμβάνονται υπόψη ήδη.
            </Text>
            <PrimaryButton title="Συμπλήρωση προφίλ" variant="secondary" onPress={() => navigation.navigate("Προφίλ" as never)} />
          </View>
        ) : null}

        {data.picks.length === 0 ? (
          <Text style={styles.empty}>
            Κανένα πιάτο του σημερινού μενού δεν ταιριάζει με όσα έχεις ορίσει. Δες παρακάτω γιατί.
          </Text>
        ) : (
          data.picks.map((pick, index) => (
            <View key={pick.item.id} style={styles.pickCard}>
              <Text style={styles.pickRank}>{index === 0 ? "Η πρώτη μας πρόταση" : `Πρόταση ${index + 1}`}</Text>
              {pick.reasons.length ? (
                <View style={styles.reasons}>
                  {pick.reasons.map((r) => (
                    <Text key={r} style={styles.reason}>
                      {r}
                    </Text>
                  ))}
                </View>
              ) : null}
              <MenuItemRow
                item={pick.item}
                quantity={quantityOf(pick.item.id)}
                onAdd={() => cart.add(pick.item)}
                onRemove={() => cart.decrement(pick.item.id)}
              />
            </View>
          ))
        )}

        {data.others.length ? (
          <>
            <Text style={styles.section}>{upperGreek("Επίσης σήμερα")}</Text>
            {data.others.map((o) => (
              <View key={o.item.id} style={styles.otherRow}>
                <MenuItemRow
                  item={o.item}
                  quantity={quantityOf(o.item.id)}
                  onAdd={() => cart.add(o.item)}
                  onRemove={() => cart.decrement(o.item.id)}
                />
              </View>
            ))}
          </>
        ) : null}

        {data.excluded.length ? (
          <>
            <Text style={styles.section}>{upperGreek("Δεν ταιριάζουν σήμερα")}</Text>
            {data.excluded.map((e) => (
              <View key={e.item.id} style={styles.excludedRow}>
                <Text style={styles.excludedName}>{e.item.name}</Text>
                <Text style={styles.excludedReason}>{e.reasons.join(" · ")}</Text>
              </View>
            ))}
          </>
        ) : null}

        <Text style={styles.disclaimer}>
          Οι προτάσεις είναι ενδεικτικές, με βάση όσα έχεις δηλώσει, και δεν αποτελούν ιατρική ή
          διαιτολογική συμβουλή. Για αλλεργίες, επιβεβαίωνε πάντα με το κατάστημα.
        </Text>
      </ScrollView>

      {cart.totalCount > 0 ? (
        <CartBar
          count={cart.totalCount}
          totalCents={cart.totalCents}
          onPress={() => navigation.navigate("Παραγγελίες" as never)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: theme.space.lg, paddingTop: theme.space.xl, paddingBottom: theme.space.xl },
  aboveCartBar: { paddingBottom: 104 },
  eyebrow: {
    fontFamily: theme.typography.fontBodyMedium,
    fontSize: theme.typography.scale.xs,
    letterSpacing: 1.2,
    color: theme.color.textMuted,
  },
  title: {
    fontFamily: theme.typography.fontDisplay,
    fontSize: theme.typography.scale["2xl"],
    lineHeight: 38,
    color: theme.color.textPrimary,
    marginTop: theme.space.xs,
  },
  subtitle: {
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.sm,
    lineHeight: 20,
    color: theme.color.textSecondary,
    marginTop: theme.space.xs,
  },
  promptCard: {
    marginTop: theme.space.lg,
    padding: theme.space.md,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surface,
    gap: theme.space.sm,
  },
  promptTitle: { fontFamily: theme.typography.fontBodySemiBold, fontSize: theme.typography.scale.base, color: theme.color.textPrimary },
  promptText: { fontFamily: theme.typography.fontBody, fontSize: theme.typography.scale.sm, lineHeight: 20, color: theme.color.textSecondary },
  empty: { fontFamily: theme.typography.fontBody, fontSize: theme.typography.scale.base, lineHeight: 23, color: theme.color.textSecondary, marginTop: theme.space.lg },
  pickCard: {
    marginTop: theme.space.lg,
    paddingHorizontal: theme.space.md,
    paddingTop: theme.space.md,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surfaceRaised,
  },
  pickRank: {
    fontFamily: theme.typography.fontBodyMedium,
    fontSize: theme.typography.scale.xs,
    letterSpacing: 0.4,
    color: theme.color.accentStrong,
  },
  reasons: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: theme.space.sm },
  reason: {
    fontFamily: theme.typography.fontBody,
    fontSize: 12,
    color: theme.color.accentStrong,
    backgroundColor: theme.color.accentSoft,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    overflow: "hidden",
  },
  section: {
    fontFamily: theme.typography.fontBodyMedium,
    fontSize: theme.typography.scale.xs,
    letterSpacing: 1.2,
    color: theme.color.textMuted,
    marginTop: theme.space.xl,
    marginBottom: theme.space.xs,
  },
  otherRow: { borderBottomWidth: 1, borderBottomColor: theme.color.border },
  excludedRow: { paddingVertical: theme.space.sm, borderBottomWidth: 1, borderBottomColor: theme.color.border },
  excludedName: { fontFamily: theme.typography.fontBodyMedium, fontSize: theme.typography.scale.base, color: theme.color.textSecondary },
  excludedReason: { fontFamily: theme.typography.fontBody, fontSize: 13, lineHeight: 18, color: theme.color.textMuted, marginTop: 2 },
  disclaimer: {
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.xs,
    lineHeight: 18,
    color: theme.color.textMuted,
    marginTop: theme.space.xl,
  },
});
