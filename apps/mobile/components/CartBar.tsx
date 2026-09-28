import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatPrice, pluralDishes } from "../lib/format";
import { Icon } from "./Icon";
import { theme } from "../theme";

/** Floating "view cart" bar above the tab bar. */
export function CartBar({ count, totalCents, onPress }: { count: number; totalCents: number; onPress: () => void }) {
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Καλάθι: ${pluralDishes(count)}, σύνολο ${formatPrice(totalCents)}`}
        style={({ pressed }) => [styles.bar, pressed && { opacity: 0.92 }]}
      >
        <View style={styles.count}><Text style={styles.countText}>{count}</Text></View>
        <Text style={styles.label}>Δες το καλάθι</Text>
        <Text style={styles.total}>{formatPrice(totalCents)}</Text>
        <Icon name="arrowRight" size={18} strokeWidth={2.2} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16, bottom: 12 },
  bar: {
    flexDirection: "row", alignItems: "center", gap: 12, height: 56, borderRadius: 18, paddingHorizontal: 16,
    backgroundColor: theme.color.accent,
    shadowColor: "#0A3D25", shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  count: { minWidth: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  countText: { fontFamily: theme.typography.fontBodySemiBold, fontSize: 13, color: "#FFFFFF" },
  label: { flex: 1, fontFamily: theme.typography.fontBodySemiBold, fontSize: 16, color: "#FFFFFF" },
  total: { fontFamily: theme.typography.fontBodySemiBold, fontSize: 16, color: "#FFFFFF" },
});
