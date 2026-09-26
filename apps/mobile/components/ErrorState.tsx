import { StyleSheet, Text, View } from "react-native";
import { PrimaryButton } from "./PrimaryButton";
import { theme } from "../theme";

interface ErrorStateProps {
  title: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title, message, onRetry }: ErrorStateProps) {
  return (
    <View style={styles.container} accessibilityRole="alert">
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <View style={styles.action}>
          <PrimaryButton title="Δοκίμασε ξανά" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.space.xl,
  },
  title: {
    fontFamily: theme.typography.fontDisplay,
    fontSize: theme.typography.scale.xl,
    color: theme.color.textPrimary,
    textAlign: "center",
  },
  message: {
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.base,
    lineHeight: 23,
    color: theme.color.textSecondary,
    textAlign: "center",
    marginTop: theme.space.sm,
    maxWidth: 340,
  },
  action: {
    marginTop: theme.space.lg,
    alignSelf: "stretch",
    maxWidth: 340,
    width: "100%",
    marginHorizontal: "auto",
  },
});
