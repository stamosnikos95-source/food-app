import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "./Icon";
import { theme } from "../theme";

interface QuantityControlProps {
  quantity: number;
  itemName: string;
  onAdd: () => void;
  onRemove: () => void;
}

/** A round "+" until the dish is in the cart, then a compact − n + stepper. */
export function QuantityControl({ quantity, itemName, onAdd, onRemove }: QuantityControlProps) {
  if (quantity === 0) {
    return (
      <Pressable onPress={onAdd} accessibilityRole="button" accessibilityLabel={`Προσθήκη στο καλάθι: ${itemName}`} hitSlop={8}
        style={({ pressed }) => [styles.add, pressed && styles.pressed]}>
        <Icon name="plus" size={18} strokeWidth={2.4} color="#FFFFFF" />
      </Pressable>
    );
  }
  return (
    <View style={styles.stepper}>
      <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={`Αφαίρεση ενός: ${itemName}`} hitSlop={6} style={styles.step}>
        <Icon name="minus" size={16} strokeWidth={2.4} color={theme.color.accentStrong} />
      </Pressable>
      <Text style={styles.quantity} accessibilityLabel={`${quantity} στο καλάθι`}>{quantity}</Text>
      <Pressable onPress={onAdd} accessibilityRole="button" accessibilityLabel={`Προσθήκη ενός ακόμα: ${itemName}`} hitSlop={6} style={styles.step}>
        <Icon name="plus" size={16} strokeWidth={2.4} color={theme.color.accentStrong} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  add: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.color.accent, alignItems: "center", justifyContent: "center" },
  pressed: { transform: [{ scale: 0.94 }] },
  stepper: { flexDirection: "row", alignItems: "center", backgroundColor: theme.color.accentSoft, borderRadius: 18, height: 36, paddingHorizontal: 4 },
  step: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  quantity: { minWidth: 20, textAlign: "center", fontFamily: theme.typography.fontBodySemiBold, fontSize: 15, color: theme.color.accentStrong },
});
