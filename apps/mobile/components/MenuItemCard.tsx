import { Pressable, StyleSheet, Text, View } from "react-native";
import { MenuItem } from "../api/client";
import { theme } from "../theme";

interface MenuItemCardProps {
  item: MenuItem;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
}

export function MenuItemCard({ item, quantity, onAdd, onRemove }: MenuItemCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.info}>
        <Text style={styles.name}>{item.name}</Text>
        {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
        <Text style={styles.macros}>
          {item.calories} kcal · {item.proteinG}g πρωτεΐνη · {item.carbsG}g υδατ. · {item.fatG}g
          λίπος · {item.portionWeightG}g
        </Text>
        <Text style={styles.price}>{(item.priceCents / 100).toFixed(2)} €</Text>
      </View>

      <View style={styles.stepper}>
        {quantity > 0 && (
          <Pressable onPress={onRemove} style={styles.stepButton}>
            <Text style={styles.stepButtonText}>−</Text>
          </Pressable>
        )}
        {quantity > 0 && <Text style={styles.quantity}>{quantity}</Text>}
        <Pressable onPress={onAdd} style={styles.stepButton}>
          <Text style={styles.stepButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.color.border,
    padding: theme.space.md,
    marginBottom: theme.space.md,
  },
  info: { flex: 1, paddingRight: theme.space.md },
  name: {
    fontFamily: theme.typography.fontDisplay,
    fontSize: theme.typography.scale.lg,
    color: theme.color.textPrimary,
  },
  description: {
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.sm,
    color: theme.color.textSecondary,
    marginTop: 2,
  },
  macros: {
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.xs,
    color: theme.color.textMuted,
    marginTop: theme.space.xs,
  },
  price: {
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.base,
    fontWeight: "600",
    color: theme.color.accentStrong,
    marginTop: theme.space.xs,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.xs,
  },
  stepButton: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  stepButtonText: {
    fontSize: theme.typography.scale.lg,
    color: theme.color.accentStrong,
    fontWeight: "600",
  },
  quantity: {
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.base,
    color: theme.color.textPrimary,
    minWidth: 18,
    textAlign: "center",
  },
});
