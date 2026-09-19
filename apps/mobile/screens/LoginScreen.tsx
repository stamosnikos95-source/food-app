import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { Field } from "../components/Field";
import { PrimaryButton } from "../components/PrimaryButton";
import { useAuth, ApiError } from "../auth/AuthContext";
import { theme } from "../theme";

interface LoginScreenProps {
  onSwitchToRegister: () => void;
}

export function LoginScreen({ onSwitchToRegister }: LoginScreenProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Κάτι πήγε στραβά");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>Food App</Text>
        <Text style={styles.title}>Καλώς ήρθες πίσω</Text>

        <View style={styles.form}>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
          />
          <Field
            label="Κωδικός"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
          />

          {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

          <PrimaryButton title="Σύνδεση" onPress={handleSubmit} loading={loading} />
        </View>

        <PrimaryButton
          title="Δεν έχεις λογαριασμό; Δημιούργησε έναν"
          onPress={onSwitchToRegister}
          variant="secondary"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.color.background },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: theme.space.lg,
  },
  eyebrow: {
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.sm,
    color: theme.color.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    textAlign: "center",
  },
  title: {
    fontFamily: theme.typography.fontDisplay,
    fontSize: theme.typography.scale["2xl"],
    color: theme.color.textPrimary,
    textAlign: "center",
    marginTop: theme.space.xs,
    marginBottom: theme.space.xl,
  },
  form: {
    marginBottom: theme.space.lg,
  },
  errorBanner: {
    fontFamily: theme.typography.fontBody,
    color: theme.color.danger,
    marginBottom: theme.space.md,
  },
});
