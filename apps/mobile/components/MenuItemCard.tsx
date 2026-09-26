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
      <View style={styles.topRow}>
        <View style={styles.photo}>
          <Text style={styles.photoEmoji}>{item.imageUrl ?? "🍽️"}</Text>
        </View>

        <View style={styles.headerText}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.price}>{(item.priceCents / 100).toFixed(2)} €</Text>
        </View>
      </View>

      {item.description ? <Text style={styles.description}>{item.description}</Text> : null}

      <View style={styles.macrosRow}>
        <Text style={styles.macroPill}>{item.calories} kcal</Text>
        <Text style={styles.macroPill}>{item.proteinG}g πρωτεΐνη</Text>
        <Text style={styles.macroPill}>{item.carbsG}g υδατ.</Text>
        <Text style={styles.macroPill}>{item.fatG}g λίπος</Text>
      </View>

      <View style={styles.bottomRow}>
        <Text style={styles.portion}>{item.portionWeightG}g μερίδα</Text>
        <View style={styles.stepper}>
          {quantity > 0 && (
            <Pressable onPress={onRemove} style={styles.stepButton}>
              <Text style={styles.stepButtonText}>−</Text>
            </Pressable>
          )}
          {quantity > 0 && <Text style={styles.quantity}>{quantity}</Text>}
          <Pressable onPress={onAdd} style={[styles.stepButton, styles.stepButtonAdd]}>
            <Text style={[styles.stepButtonText, styles.stepButtonTextAdd]}>+</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.color.border,
    padding: theme.space.md,
    marginBottom: theme.space.md,
    shadowColor: "#20241E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  photo: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.color.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: theme.space.md,
  },
  photoEmoji: {
    fontSize: 28,
  },
  headerText: { flex: 1 },
  name: {
    fontFamily: theme.typography.fontDisplay,
    fontSize: theme.typography.scale.lg,
    color: theme.color.textPrimary,
  },
  price: {
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.base,
    fontWeight: "600",
    color: theme.color.accentStrong,
    marginTop: 2,
  },
  description: {
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.sm,
    color: theme.color.textSecondary,
    marginTop: theme.space.sm,
  },
  macrosRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.space.xs,
    marginTop: theme.space.sm,
  },
  macroPill: {
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.xs,
    color: theme.color.textSecondary,
    backgroundColor: theme.color.background,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.space.sm,
    paddingVertical: 3,
    overflow: "hidden",
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: theme.space.md,
  },
  portion: {
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.xs,
    color: theme.color.textMuted,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.sm,
  },
  stepButton: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.background,
    borderWidth: 1,
    borderColor: theme.color.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepButtonAdd: {
    backgroundColor: theme.color.accent,
    borderColor: theme.color.accent,
  },
  stepButtonText: {
    fontSize: theme.typography.scale.lg,
    color: theme.color.textPrimary,
    fontWeight: "600",
  },
  stepButtonTextAdd: {
    color: theme.color.surface,
  },
  quantity: {
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.base,
    color: theme.color.textPrimary,
    minWidth: 18,
    textAlign: "center",
  },
});
