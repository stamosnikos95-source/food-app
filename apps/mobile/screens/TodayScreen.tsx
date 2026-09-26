import { useCallback, useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../auth/AuthContext";
import { useCart } from "../cart/CartContext";
import { api, MenuItem } from "../api/client";
import { describeError } from "../api/errors";
import { Screen } from "../components/Screen";
import { MenuItemRow } from "../components/MenuItemRow";
import { CartBar } from "../components/CartBar";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { formatLongDate, pluralDishes, upperGreek } from "../lib/format";
import { theme } from "../theme";

type MenuState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; items: MenuItem[] };

export function TodayScreen() {
  const { withAuth } = useAuth();
  const cart = useCart();
  const navigation = useNavigation();
  const [state, setState] = useState<MenuState>({ status: "loading" });

  const load = useCallback(() => {
    setState({ status: "loading" });
    withAuth((token) => api.getMenu(token))
      .then((items) => setState({ status: "ready", items }))
      .catch((error) => setState({ status: "error", message: describeError(error) }));
  }, [withAuth]);

  useEffect(load, [load]);

  const quantityOf = (id: string) => cart.lines.find((l) => l.item.id === id)?.quantity ?? 0;

  if (state.status === "loading") {
    return (
      <Screen>
        <LoadingState label="Φορτώνει το μενού…" />
      </Screen>
    );
  }

  if (state.status === "error") {
    return (
      <Screen>
        <ErrorState title="Δεν φόρτωσε το μενού" message={state.message} onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={state.items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, cart.totalCount > 0 && styles.listAboveCartBar]}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>{upperGreek(formatLongDate(new Date()))}</Text>
            <Text style={styles.title} accessibilityRole="header">
              Το μενού της ημέρας
            </Text>
            <Text style={styles.subtitle}>
              {pluralDishes(state.items.length)} · παραλαβή από το κατάστημα
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <MenuItemRow
            item={item}
            quantity={quantityOf(item.id)}
            onAdd={() => cart.add(item)}
            onRemove={() => cart.decrement(item.id)}
          />
        )}
        ListFooterComponent={
          <Text style={styles.disclaimer}>
            Οι διατροφικές τιμές είναι ενδεικτικές, ανά μερίδα, και δεν αποτελούν ιατρική ή
            διαιτολογική συμβουλή.
          </Text>
        }
      />

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
  list: {
    paddingHorizontal: theme.space.lg,
    paddingBottom: theme.space.xl,
  },
  listAboveCartBar: {
    paddingBottom: 104,
  },
  header: {
    paddingTop: theme.space.xl,
    paddingBottom: theme.space.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.borderStrong,
  },
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
    color: theme.color.textSecondary,
    marginTop: theme.space.xs,
  },
  separator: {
    height: 1,
    backgroundColor: theme.color.border,
  },
  disclaimer: {
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.xs,
    lineHeight: 18,
    color: theme.color.textMuted,
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
    paddingTop: theme.space.md,
  },
});
