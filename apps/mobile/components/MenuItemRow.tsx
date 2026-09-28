import { Pressable, StyleSheet, Text, View } from "react-native";
import { allergenLabel } from "@food-app/shared-types";
import { MenuItem } from "../api/client";
import { useOpenDish } from "../dish/DishSheet";
import { formatGrams, formatPrice } from "../lib/format";
import { DishImage } from "./DishImage";
import { QuantityControl } from "./QuantityControl";
import { theme } from "../theme";

interface MenuItemRowProps {
  item: MenuItem;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
}

/** Dish card: photo, name, key facts, price and quick add. Tap for details. */
export function MenuItemRow({ item, quantity, onAdd, onRemove }: MenuItemRowProps) {
  const openDish = useOpenDish();
  const diet = item.dietTags?.includes("vegan") ? "Vegan" : item.dietTags?.includes("vegetarian") ? "Χορτοφαγικό" : null;
  return (
    <Pressable onPress={() => openDish(item)} accessibilityRole="button" accessibilityHint="Λεπτομέρειες πιάτου"
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}>
      <DishImage uri={item.imageUrl} style={styles.photo} />
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
        {item.description ? <Text style={styles.description} numberOfLines={1}>{item.description}</Text> : null}
        <Text style={styles.meta} numberOfLines={1}>
          {item.calories} kcal · {formatGrams(item.proteinG)}g πρωτεΐνη{diet ? ` · ${diet}` : ""}
        </Text>
        <Text style={styles.allergens} numberOfLines={1}>
          {item.allergens.length > 0 ? `Αλλεργιογόνα: ${item.allergens.map(allergenLabel).join(", ")}` : "Αλλεργιογόνα: ρώτησε στο κατάστημα"}
        </Text>
        <View style={styles.footer}>
          <Text style={styles.price}>{formatPrice(item.priceCents)}</Text>
          <QuantityControl quantity={quantity} itemName={item.name} onAdd={onAdd} onRemove={onRemove} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.color.border },
  photo: { width: 104, height: 104, borderRadius: 16 },
  body: { flex: 1, minHeight: 104 },
  name: { fontFamily: theme.typography.fontBodySemiBold, fontSize: 16, lineHeight: 21, color: theme.color.textPrimary },
  description: { fontFamily: theme.typography.fontBody, fontSize: 13, lineHeight: 18, color: theme.color.textSecondary, marginTop: 2 },
  meta: { fontFamily: theme.typography.fontBody, fontSize: 13, color: theme.color.textMuted, marginTop: 4 },
  allergens: { fontFamily: theme.typography.fontBody, fontSize: 12, color: theme.color.highlight, marginTop: 2 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: 6 },
  price: { fontFamily: theme.typography.fontBodySemiBold, fontSize: 16, color: theme.color.textPrimary },
});
