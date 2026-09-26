import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatPrice, pluralDishes } from "../lib/format";
import { Icon } from "./Icon";
import { theme } from "../theme";

interface CartBarProps {
  count: number;
  totalCents: number;
  onPress: () => void;
}

/** Floating summary above the tab bar while the cart has items. */
export function CartBar({ count, totalCents, onPress }: CartBarProps) {
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Καλάθι: ${pluralDishes(count)}, σύνολο ${formatPrice(totalCents)}`}
        style={({ pressed }) => [styles.bar, pressed && styles.pressed]}
      >
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count}</Text>
        </View>
        <Text style={styles.label}>Καλάθι</Text>
        <Text style={styles.total}>{formatPrice(totalCents)}</Text>
        <Icon name="arrowRight" size={18} strokeWidth={2} color={theme.color.surface} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: theme.space.md,
    paddingBottom: theme.space.md,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.sm,
    height: 56,
    paddingHorizontal: theme.space.md,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.color.accentStrong,
    shadowColor: "#20241E",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 6,
  },
  pressed: { opacity: 0.92 },
  badge: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontFamily: theme.typography.fontBodySemiBold,
    fontSize: 13,
    color: theme.color.surface,
  },
  label: {
    flex: 1,
    fontFamily: theme.typography.fontBodyMedium,
    fontSize: theme.typography.scale.base,
    color: theme.color.surface,
  },
  total: {
    fontFamily: theme.typography.fontBodySemiBold,
    fontSize: theme.typography.scale.base,
    color: theme.color.surface,
  },
});
