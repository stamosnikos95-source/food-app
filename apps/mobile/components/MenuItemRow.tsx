import { StyleSheet, Text, View } from "react-native";
import { allergenLabel } from "@food-app/shared-types";
import { MenuItem } from "../api/client";
import { formatGrams, formatPrice } from "../lib/format";
import { QuantityControl } from "./QuantityControl";
import { theme } from "../theme";

interface MenuItemRowProps {
  item: MenuItem;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
}

/**
 * A dish as a line on a printed menu: name and price on one baseline,
 * description, then nutrition. Typographic on purpose — no stock photos
 * standing in for the kitchen's real food until real photography exists.
 */
export function MenuItemRow({ item, quantity, onAdd, onRemove }: MenuItemRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.titleLine}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.price}>{formatPrice(item.priceCents)}</Text>
      </View>

      {item.description ? <Text style={styles.description}>{item.description}</Text> : null}

      <Text style={styles.nutrition}>
        <Text style={styles.kcal}>{item.calories} kcal</Text>
        {`   ${formatGrams(item.proteinG)}g πρωτεΐνη · ${formatGrams(item.carbsG)}g υδατάνθρ. · ${formatGrams(item.fatG)}g λιπαρά`}
      </Text>

      {/* An empty list can mean "none" or "not entered yet". Someone with an
          allergy must never read silence as "safe", so say where to ask. */}
      <Text style={styles.allergens}>
        {item.allergens.length > 0
          ? `Αλλεργιογόνα: ${item.allergens.map(allergenLabel).join(", ")}`
          : "Αλλεργιογόνα: ρώτησε στο κατάστημα"}
      </Text>

      <View style={styles.footerLine}>
        <Text style={styles.portion}>Μερίδα {item.portionWeightG}g</Text>
        <QuantityControl
          quantity={quantity}
          itemName={item.name}
          onAdd={onAdd}
          onRemove={onRemove}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: theme.space.lg,
  },
  titleLine: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: theme.space.md,
  },
  name: {
    flex: 1,
    fontFamily: theme.typography.fontDisplay,
    fontSize: theme.typography.scale.lg,
    lineHeight: 26,
    color: theme.color.textPrimary,
  },
  price: {
    fontFamily: theme.typography.fontBodyMedium,
    fontSize: theme.typography.scale.base,
    color: theme.color.accentStrong,
  },
  description: {
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.sm,
    lineHeight: 21,
    color: theme.color.textSecondary,
    marginTop: theme.space.xs,
  },
  nutrition: {
    fontFamily: theme.typography.fontBody,
    fontSize: 13,
    lineHeight: 19,
    color: theme.color.textSecondary,
    marginTop: theme.space.sm,
  },
  kcal: {
    fontFamily: theme.typography.fontBodySemiBold,
    color: theme.color.textPrimary,
  },
  allergens: {
    fontFamily: theme.typography.fontBodyMedium,
    fontSize: 13,
    lineHeight: 19,
    color: theme.color.highlight,
    marginTop: theme.space.xs,
  },
  footerLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: theme.space.md,
  },
  portion: {
    fontFamily: theme.typography.fontBody,
    fontSize: 13,
    color: theme.color.textMuted,
  },
});
