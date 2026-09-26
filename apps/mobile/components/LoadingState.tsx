import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { theme } from "../theme";

/** Spinner plus an honest explanation if the (free-tier) server is waking up. */
export function LoadingState({ label }: { label: string }) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      <ActivityIndicator color={theme.color.accent} size="large" />
      <Text style={styles.label}>{label}</Text>
      {slow ? (
        <Text style={styles.hint}>
          Ο server ξυπνάει μετά από ώρα αδράνειας — μπορεί να χρειαστεί έως ένα λεπτό.
        </Text>
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
  label: {
    fontFamily: theme.typography.fontBodyMedium,
    fontSize: theme.typography.scale.base,
    color: theme.color.textSecondary,
    marginTop: theme.space.md,
  },
  hint: {
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.sm,
    lineHeight: 20,
    color: theme.color.textMuted,
    textAlign: "center",
    marginTop: theme.space.sm,
    maxWidth: 300,
  },
});
