import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { theme } from "../theme";

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary";
}

export function PrimaryButton({
  title,
  onPress,
  loading,
  disabled,
  variant = "primary",
}: PrimaryButtonProps) {
  const isPrimary = variant === "primary";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && !loading && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? theme.color.surface : theme.color.accent} />
      ) : (
        <Text style={isPrimary ? styles.primaryText : styles.secondaryText}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radius.md,
    paddingVertical: theme.space.sm + 4,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  primary: {
    backgroundColor: theme.color.accent,
  },
  secondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
  primaryText: {
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.base,
    fontWeight: "600",
    color: theme.color.surface,
  },
  secondaryText: {
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.base,
    fontWeight: "600",
    color: theme.color.textPrimary,
  },
});
