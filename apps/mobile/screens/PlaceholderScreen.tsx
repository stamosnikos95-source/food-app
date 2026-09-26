import { StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import { upperGreek } from "../lib/format";
import { theme } from "../theme";

interface PlaceholderScreenProps {
  eyebrow: string;
  title: string;
  subtitle: string;
}

export function PlaceholderScreen({ eyebrow, title, subtitle }: PlaceholderScreenProps) {
  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>{upperGreek(eyebrow)}</Text>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.space.xl,
  },
  eyebrow: {
    fontFamily: theme.typography.fontBodyMedium,
    fontSize: theme.typography.scale.xs,
    letterSpacing: 1.2,
    color: theme.color.textMuted,
  },
  title: {
    fontFamily: theme.typography.fontDisplay,
    fontSize: theme.typography.scale["2xl"],
    lineHeight: 38,
    color: theme.color.textPrimary,
    marginTop: theme.space.sm,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.base,
    lineHeight: 23,
    color: theme.color.textSecondary,
    marginTop: theme.space.sm,
    textAlign: "center",
    maxWidth: 320,
  },
});
