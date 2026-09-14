import { StyleSheet, Text, View } from "react-native";
import { theme } from "../theme";

interface PlaceholderScreenProps {
  title: string;
  subtitle: string;
  milestone: string;
}

export function PlaceholderScreen({ title, subtitle, milestone }: PlaceholderScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>{milestone}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.background,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.space.lg,
  },
  eyebrow: {
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.sm,
    color: theme.color.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontFamily: theme.typography.fontDisplay,
    fontSize: theme.typography.scale["2xl"],
    color: theme.color.textPrimary,
    marginTop: theme.space.sm,
  },
  subtitle: {
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.base,
    color: theme.color.textSecondary,
    marginTop: theme.space.sm,
    textAlign: "center",
  },
});
