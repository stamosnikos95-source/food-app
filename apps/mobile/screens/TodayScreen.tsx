import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../auth/AuthContext";
import { useCart } from "../cart/CartContext";
import { api, MenuItem, RankedItem } from "../api/client";
import { describeError } from "../api/errors";
import { Screen } from "../components/Screen";
import { MenuItemRow } from "../components/MenuItemRow";
import { CartBar } from "../components/CartBar";
import { DishImage } from "../components/DishImage";
import { QuantityControl } from "../components/QuantityControl";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { GymBanner } from "../gym/GymBanner";
import { useOpenDish } from "../dish/DishSheet";
import { formatGrams, formatLongDate, formatPrice } from "../lib/format";
import { theme } from "../theme";

type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; items: MenuItem[] };

const CATEGORIES: { key: string; label: string; test: (i: MenuItem) => boolean }[] = [
  { key: "all", label: "Όλα", test: () => true },
  { key: "protein", label: "Υψηλή πρωτεΐνη", test: (i) => i.proteinG >= 35 },
  { key: "light", label: "Έως 500 kcal", test: (i) => i.calories <= 500 },
  { key: "plant", label: "Vegan & χορτοφαγικά", test: (i) => (i.dietTags ?? []).length > 0 },
  { key: "budget", label: "Έως 8 €", test: (i) => i.priceCents <= 800 },
];

const greeting = () => (new Date().getHours() < 13 ? "Καλημέρα" : "Καλησπέρα");

export function TodayScreen() {
  const { withAuth } = useAuth();
  const cart = useCart();
  const navigation = useNavigation();
  const openDish = useOpenDish();
  const [state, setState] = useState<State>({ status: "loading" });
  const [picks, setPicks] = useState<RankedItem[]>([]);
  const [category, setCategory] = useState("all");

  const load = useCallback(() => {
    setState({ status: "loading" });
    withAuth((token) => api.getMenu(token))
      .then((items) => setState({ status: "ready", items }))
      .catch((error) => setState({ status: "error", message: describeError(error) }));
    withAuth((token) => api.getRecommendations(token))
      .then((r) => setPicks(r.picks))
      .catch(() => setPicks([]));
  }, [withAuth]);
  useEffect(load, [load]);

  const quantityOf = (id: string) => cart.lines.find((l) => l.item.id === id)?.quantity ?? 0;
  const visible = useMemo(() => {
    if (state.status !== "ready") return [];
    const test = CATEGORIES.find((c) => c.key === category)?.test ?? (() => true);
    return state.items.filter(test);
  }, [state, category]);

  if (state.status === "loading") return <Screen><LoadingState label="Φόρτωση μενού…" /></Screen>;
  if (state.status === "error") return <Screen><ErrorState title="Δεν φόρτωσε το μενού" message={state.message} onRetry={load} /></Screen>;

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.container, cart.totalCount > 0 && { paddingBottom: 96 }]}>
        <View style={styles.header}>
          <GymBanner />
          <Text style={styles.greeting}>{greeting()}</Text>
          <Text style={styles.title} accessibilityRole="header">Τι θα φάμε σήμερα;</Text>
          <Text style={styles.subtitle}>{formatLongDate(new Date())} · παραλαβή από το κατάστημα</Text>
        </View>

        {picks.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Για σένα</Text>
              <Pressable onPress={() => navigation.navigate("Βοηθός" as never)} accessibilityRole="link" hitSlop={8}>
                <Text style={styles.sectionLink}>Γιατί αυτά;</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
              {picks.map((p) => (
                <Pressable key={p.item.id} onPress={() => openDish(p.item)} style={styles.feature} accessibilityRole="button" accessibilityLabel={`${p.item.name}, ${formatPrice(p.item.priceCents)}`}>
                  <View>
                    <DishImage uri={p.item.imageUrl} style={styles.featurePhoto} />
                    {p.reasons[0] ? <Text style={styles.reason} numberOfLines={1}>{p.reasons[0]}</Text> : null}
                  </View>
                  <Text style={styles.featureName} numberOfLines={1}>{p.item.name}</Text>
                  <Text style={styles.featureMeta}>{p.item.calories} kcal · {formatGrams(p.item.proteinG)}g πρωτεΐνη</Text>
                  <View style={styles.featureFooter}>
                    <Text style={styles.featurePrice}>{formatPrice(p.item.priceCents)}</Text>
                    <QuantityControl quantity={quantityOf(p.item.id)} itemName={p.item.name} onAdd={() => cart.add(p.item)} onRemove={() => cart.decrement(p.item.id)} />
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {CATEGORIES.map((c) => {
            const active = c.key === category;
            return (
              <Pressable key={c.key} onPress={() => setCategory(c.key)} accessibilityRole="tab" accessibilityState={{ selected: active }}
                style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.list}>
          <Text style={styles.sectionTitle}>Μενού ημέρας</Text>
          {visible.length === 0 ? (
            <Text style={styles.empty}>Κανένα πιάτο σε αυτή την κατηγορία σήμερα.</Text>
          ) : (
            visible.map((item) => (
              <MenuItemRow key={item.id} item={item} quantity={quantityOf(item.id)} onAdd={() => cart.add(item)} onRemove={() => cart.decrement(item.id)} />
            ))
          )}
          <Text style={styles.footnote}>Για αλλεργίες, ρώτησε στο κατάστημα πριν παραγγείλεις. Τα διατροφικά στοιχεία είναι ενδεικτικά.</Text>
        </View>
      </ScrollView>
      {cart.totalCount > 0 ? (
        <CartBar count={cart.totalCount} totalCents={cart.totalCents} onPress={() => navigation.navigate("Παραγγελίες" as never)} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 12, paddingBottom: 24 },
  header: { paddingHorizontal: 20, paddingTop: 8 },
  greeting: { fontFamily: theme.typography.fontBodyMedium, fontSize: 15, color: theme.color.accent },
  title: { fontFamily: theme.typography.fontDisplay, fontSize: 28, lineHeight: 34, color: theme.color.textPrimary, marginTop: 2 },
  subtitle: { fontFamily: theme.typography.fontBody, fontSize: 14, color: theme.color.textMuted, marginTop: 4 },
  section: { marginTop: 24 },
  sectionHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { fontFamily: theme.typography.fontDisplay, fontSize: 20, color: theme.color.textPrimary },
  sectionLink: { fontFamily: theme.typography.fontBodyMedium, fontSize: 14, color: theme.color.accent },
  carousel: { paddingHorizontal: 20, gap: 14 },
  feature: { width: 250 },
  featurePhoto: { width: 250, height: 160, borderRadius: 18 },
  reason: {
    position: "absolute", left: 10, bottom: 10, maxWidth: 230, overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.95)", color: theme.color.accentStrong, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4, fontFamily: theme.typography.fontBodyMedium, fontSize: 12,
  },
  featureName: { fontFamily: theme.typography.fontBodySemiBold, fontSize: 16, color: theme.color.textPrimary, marginTop: 10 },
  featureMeta: { fontFamily: theme.typography.fontBody, fontSize: 13, color: theme.color.textMuted, marginTop: 2 },
  featureFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  featurePrice: { fontFamily: theme.typography.fontBodySemiBold, fontSize: 16, color: theme.color.textPrimary },
  chips: { paddingHorizontal: 20, gap: 8, paddingTop: 24, paddingBottom: 4 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: theme.color.border, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: theme.color.surface },
  chipActive: { backgroundColor: theme.color.textPrimary, borderColor: theme.color.textPrimary },
  chipText: { fontFamily: theme.typography.fontBodyMedium, fontSize: 14, color: theme.color.textSecondary },
  chipTextActive: { color: "#FFFFFF" },
  list: { paddingHorizontal: 20, marginTop: 20 },
  empty: { fontFamily: theme.typography.fontBody, fontSize: 15, color: theme.color.textMuted, paddingVertical: 24 },
  footnote: { fontFamily: theme.typography.fontBody, fontSize: 12, lineHeight: 18, color: theme.color.textMuted, marginTop: 16 },
});
