import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "./Icon";
import { theme } from "../theme";

interface QuantityControlProps {
  quantity: number;
  itemName: string;
  onAdd: () => void;
  onRemove: () => void;
}

/** "Προσθήκη" pill that turns into a − n + stepper once the dish is in the cart. */
export function QuantityControl({ quantity, itemName, onAdd, onRemove }: QuantityControlProps) {
  if (quantity === 0) {
    return (
      <Pressable
        onPress={onAdd}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Προσθήκη στο καλάθι: ${itemName}`}
        style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
      >
        <Icon name="plus" size={16} strokeWidth={2} color={theme.color.accentStrong} />
        <Text style={styles.addLabel}>Προσθήκη</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={onRemove}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Αφαίρεση ενός: ${itemName}`}
        style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
      >
        <Icon name="minus" size={18} strokeWidth={2} color={theme.color.surface} />
      </Pressable>
      <Text style={styles.quantity} accessibilityLabel={`${quantity} στο καλάθι`}>
        {quantity}
      </Text>
      <Pressable
        onPress={onAdd}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Προσθήκη ενός ακόμα: ${itemName}`}
        style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
      >
        <Icon name="plus" size={18} strokeWidth={2} color={theme.color.surface} />
      </Pressable>
    </View>
  );
}

const CONTROL_HEIGHT = 40;

const styles = StyleSheet.create({
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: CONTROL_HEIGHT,
    paddingHorizontal: theme.space.md,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.color.accent,
    backgroundColor: theme.color.surface,
  },
  addLabel: {
    fontFamily: theme.typography.fontBodySemiBold,
    fontSize: theme.typography.scale.sm,
    color: theme.color.accentStrong,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    height: CONTROL_HEIGHT,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.accent,
    paddingHorizontal: 2,
  },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  quantity: {
    minWidth: 22,
    textAlign: "center",
    fontFamily: theme.typography.fontBodySemiBold,
    fontSize: theme.typography.scale.base,
    color: theme.color.surface,
  },
  pressed: { opacity: 0.7 },
});
