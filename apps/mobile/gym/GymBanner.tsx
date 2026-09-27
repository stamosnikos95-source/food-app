import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "../theme";
import { useGym } from "./GymContext";

/** "Μέσω Pulse Gym · −10% για μέλη" with a way to order without the gym. */
export function GymBanner() {
  const { gym, clear } = useGym();
  if (!gym) return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        Μέσω <Text style={styles.strong}>{gym.name}</Text>
        {gym.discountPercent > 0 ? ` · −${gym.discountPercent}% για μέλη` : ""}
        {gym.deliveryEnabled ? " · παράδοση στο γυμναστήριο" : ""}
      </Text>
      <Pressable onPress={clear} hitSlop={10} accessibilityRole="button" accessibilityLabel="Παραγγελία χωρίς το γυμναστήριο">
        <Text style={styles.close}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.sm,
    backgroundColor: theme.color.accentSoft,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
    marginBottom: theme.space.md,
  },
  text: { flex: 1, fontFamily: theme.typography.fontBody, fontSize: theme.typography.scale.sm, color: theme.color.accentStrong, lineHeight: 20 },
  strong: { fontFamily: theme.typography.fontBodySemiBold },
  close: { fontSize: 16, color: theme.color.accentStrong },
});
