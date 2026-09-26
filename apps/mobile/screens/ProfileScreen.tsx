import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { Field } from "../components/Field";
import { PrimaryButton } from "../components/PrimaryButton";
import { Screen } from "../components/Screen";
import { useAuth } from "../auth/AuthContext";
import { api, Profile } from "../api/client";
import { describeError } from "../api/errors";
import { parseDecimal, upperGreek } from "../lib/format";
import { theme } from "../theme";

const ACTIVITY_LEVELS: { value: string; label: string }[] = [
  { value: "sedentary", label: "Καθιστική ζωή" },
  { value: "light", label: "Ελαφριά δραστηριότητα" },
  { value: "moderate", label: "Μέτρια δραστηριότητα" },
  { value: "active", label: "Δραστήριος" },
  { value: "very_active", label: "Πολύ δραστήριος" },
];

export function ProfileScreen() {
  const { withAuth, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [age, setAge] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [activityLevel, setActivityLevel] = useState<string | null>(null);
  const [goal, setGoal] = useState("");
  const [budgetEuros, setBudgetEuros] = useState("");
  const [dietaryPreferences, setDietaryPreferences] = useState("");
  const [excludedIngredients, setExcludedIngredients] = useState("");

  useEffect(() => {
    withAuth((token) => api.getProfile(token))
      .then((profile: Profile) => {
        setAge(profile.age?.toString() ?? "");
        setHeightCm(profile.heightCm?.toString() ?? "");
        setActivityLevel(profile.activityLevel);
        setGoal(profile.goal ?? "");
        setBudgetEuros(
          profile.budgetPerMealCents != null
            ? (profile.budgetPerMealCents / 100).toFixed(2).replace(".", ",")
            : "",
        );
        setWeightKg(profile.weightKg != null ? String(profile.weightKg).replace(".", ",") : "");
        setDietaryPreferences(profile.dietaryPreferences.join(", "));
        setExcludedIngredients(profile.excludedIngredients.join(", "));
      })
      .catch((e) => setError(describeError(e)))
      .finally(() => setLoading(false));
  }, [withAuth]);

  async function handleSave() {
    setError(null);
    setSaved(false);
    setSaving(true);
    // Greek keyboards type decimal commas ("8,50"); parse them explicitly,
    // otherwise Number("8,50") is NaN and the value is silently dropped.
    const budget = parseDecimal(budgetEuros);
    const parsedAge = parseDecimal(age);
    const parsedHeight = parseDecimal(heightCm);
    try {
      const patch = {
        age: parsedAge !== undefined ? Math.round(parsedAge) : undefined,
        heightCm: parsedHeight !== undefined ? Math.round(parsedHeight) : undefined,
        weightKg: parseDecimal(weightKg),
        activityLevel: activityLevel ?? undefined,
        goal: goal || undefined,
        budgetPerMealCents: budget !== undefined ? Math.round(budget * 100) : undefined,
        dietaryPreferences: dietaryPreferences
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        excludedIngredients: excludedIngredients
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };
      await withAuth((token) => api.updateProfile(token, patch));
      setSaved(true);
    } catch (e) {
      setError(
        describeError(e, {
          400: "Κάποια τιμή δεν είναι έγκυρη — έλεγξε ηλικία (13–120), ύψος (100–250 cm) και βάρος.",
        }),
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={theme.color.accent} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        Το προφίλ μου
      </Text>
      <Text style={styles.intro}>
        Με αυτά τα στοιχεία ο βοηθός θα προτείνει πιάτα από το μενού. Όλα είναι προαιρετικά.
      </Text>

      <Text style={styles.sectionLabel}>{upperGreek("Σωματικά στοιχεία")}</Text>

      <Field label="Ηλικία" value={age} onChangeText={setAge} keyboardType="number-pad" />
      <Field
        label="Ύψος (cm)"
        value={heightCm}
        onChangeText={setHeightCm}
        keyboardType="number-pad"
      />
      <Field
        label="Βάρος (kg)"
        value={weightKg}
        onChangeText={setWeightKg}
        keyboardType="decimal-pad"
      />

      <Text style={styles.label}>Επίπεδο δραστηριότητας</Text>
      <View style={styles.chipRow}>
        {ACTIVITY_LEVELS.map((level) => {
          const selected = activityLevel === level.value;
          return (
            <Pressable
              key={level.value}
              onPress={() => setActivityLevel(level.value)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {level.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>{upperGreek("Στόχοι & προτιμήσεις")}</Text>
      <Field
        label="Στόχος"
        value={goal}
        onChangeText={setGoal}
        placeholder="π.χ. απώλεια βάρους, μυϊκή μάζα, ισορροπία"
      />
      <Field
        label="Budget ανά γεύμα (€)"
        value={budgetEuros}
        onChangeText={setBudgetEuros}
        keyboardType="decimal-pad"
        placeholder="π.χ. 8.50"
      />
      <Field
        label="Διατροφικές προτιμήσεις"
        value={dietaryPreferences}
        onChangeText={setDietaryPreferences}
        placeholder="π.χ. vegetarian, χωρίς λακτόζη"
      />
      <Field
        label="Αποκλεισμοί"
        value={excludedIngredients}
        onChangeText={setExcludedIngredients}
        placeholder="π.χ. θαλασσινά, ξηροί καρποί"
      />

      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
      {saved ? <Text style={styles.savedBanner}>Αποθηκεύτηκε</Text> : null}

      <PrimaryButton title="Αποθήκευση" onPress={handleSave} loading={saving} />
      <View style={styles.logoutSpacing}>
        <PrimaryButton title="Αποσύνδεση" onPress={logout} variant="secondary" />
      </View>
    </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.color.background },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.color.background,
  },
  container: {
    paddingHorizontal: theme.space.lg,
    paddingTop: theme.space.xl,
    paddingBottom: theme.space["2xl"],
  },
  intro: {
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.sm,
    lineHeight: 21,
    color: theme.color.textSecondary,
    marginBottom: theme.space.lg,
  },
  sectionLabel: {
    fontFamily: theme.typography.fontBodyMedium,
    fontSize: theme.typography.scale.xs,
    letterSpacing: 1.2,
    color: theme.color.textMuted,
    marginTop: theme.space.sm,
    marginBottom: theme.space.md,
  },
  title: {
    fontFamily: theme.typography.fontDisplay,
    fontSize: theme.typography.scale["2xl"],
    lineHeight: 38,
    color: theme.color.textPrimary,
    marginBottom: theme.space.xs,
  },
  label: {
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.sm,
    color: theme.color.textSecondary,
    marginBottom: theme.space.xs,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.space.xs,
    marginBottom: theme.space.md,
  },
  chip: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.xs + 2,
    backgroundColor: theme.color.surface,
  },
  chipSelected: {
    backgroundColor: theme.color.accentSoft,
    borderColor: theme.color.accent,
  },
  chipText: {
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.sm,
    color: theme.color.textSecondary,
  },
  chipTextSelected: {
    fontFamily: theme.typography.fontBodyMedium,
    color: theme.color.accentStrong,
  },
  errorBanner: {
    fontFamily: theme.typography.fontBody,
    color: theme.color.danger,
    marginBottom: theme.space.md,
  },
  savedBanner: {
    fontFamily: theme.typography.fontBody,
    color: theme.color.success,
    marginBottom: theme.space.md,
  },
  logoutSpacing: {
    marginTop: theme.space.md,
  },
});
