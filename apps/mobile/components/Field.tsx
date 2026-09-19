import { StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import { theme } from "../theme";

interface FieldProps extends TextInputProps {
  label: string;
  error?: string;
}

export function Field({ label, error, style, ...inputProps }: FieldProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, style]}
        placeholderTextColor={theme.color.textMuted}
        {...inputProps}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: theme.space.md,
  },
  label: {
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.sm,
    color: theme.color.textSecondary,
    marginBottom: theme.space.xs,
  },
  input: {
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.base,
    color: theme.color.textPrimary,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm + 2,
    backgroundColor: theme.color.surface,
  },
  error: {
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.xs,
    color: theme.color.danger,
    marginTop: theme.space.xs,
  },
});
