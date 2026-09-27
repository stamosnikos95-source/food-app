import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "../theme";

export interface ChipOption {
  value: string;
  label: string;
}

interface ChipGroupProps {
  label: string;
  hint?: string;
  options: readonly ChipOption[];
  isSelected: (value: string) => boolean;
  onPress: (value: string) => void;
}

/** Tappable options — faster than typing on a phone, and never misspelled. */
export function ChipGroup({ label, hint, options, isSelected, onPress }: ChipGroupProps) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <View style={styles.row}>
        {options.map((o) => {
          const selected = isSelected(o.value);
          return (
            <Pressable
              key={o.value || "none"}
              onPress={() => onPress(o.value)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: theme.space.md },
  label: {
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.sm,
    color: theme.color.textSecondary,
    marginBottom: theme.space.xs,
  },
  hint: {
    fontFamily: theme.typography.fontBody,
    fontSize: 13,
    lineHeight: 18,
    color: theme.color.textMuted,
    marginTop: -2,
    marginBottom: theme.space.sm,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: theme.space.xs },
  chip: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.xs + 2,
    backgroundColor: theme.color.surface,
  },
  chipSelected: { backgroundColor: theme.color.accentSoft, borderColor: theme.color.accent },
  chipText: { fontFamily: theme.typography.fontBody, fontSize: theme.typography.scale.sm, color: theme.color.textSecondary },
  chipTextSelected: { fontFamily: theme.typography.fontBodyMedium, color: theme.color.accentStrong },
});
