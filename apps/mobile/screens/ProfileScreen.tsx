import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { Field } from "../components/Field";
import { PrimaryButton } from "../components/PrimaryButton";
import { useAuth, ApiError } from "../auth/AuthContext";
import { api, Profile } from "../api/client";
import { theme } from "../theme";

const ACTIVITY_LEVELS: { value: string; label: string }[] = [
  { value: "sedentary", label: "Καθιστική ζωή" },
  { value: "light", label: "Ελαφριά δραστηριότητα" },
  { value: "moderate", label: "Μέτρια δραστηριότητα" },
  { value: "active", label: "Δραστήριος" },
  { value: "very_active", label: "Πολύ δραστήριος" },
];

export function ProfileScreen() {
  const { accessToken, logout } = useAuth();
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
    if (!accessToken) return;
    api
      .getProfile(accessToken)
      .then((profile: Profile) => {
        setAge(profile.age?.toString() ?? "");
        setHeightCm(profile.heightCm?.toString() ?? "");
        setWeightKg(profile.weightKg?.toString() ?? "");
        setActivityLevel(profile.activityLevel);
        setGoal(profile.goal ?? "");
        setBudgetEuros(
          profile.budgetPerMealCents != null ? (profile.budgetPerMealCents / 100).toString() : "",
        );
        setDietaryPreferences(profile.dietaryPreferences.join(", "));
        setExcludedIngredients(profile.excludedIngredients.join(", "));
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Κάτι πήγε στραβά"))
      .finally(() => setLoading(false));
  }, [accessToken]);

  async function handleSave() {
    if (!accessToken) return;
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await api.updateProfile(accessToken, {
        age: age ? Number(age) : undefined,
        heightCm: heightCm ? Number(heightCm) : undefined,
        weightKg: weightKg ? Number(weightKg) : undefined,
        activityLevel: activityLevel ?? undefined,
        goal: goal || undefined,
        budgetPerMealCents: budgetEuros ? Math.round(Number(budgetEuros) * 100) : undefined,
        dietaryPreferences: dietaryPreferences
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        excludedIngredients: excludedIngredients
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Κάτι πήγε στραβά");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.color.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Το προφίλ μου</Text>

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
  container: { padding: theme.space.lg, paddingBottom: theme.space["2xl"] },
  title: {
    fontFamily: theme.typography.fontDisplay,
    fontSize: theme.typography.scale["2xl"],
    color: theme.color.textPrimary,
    marginBottom: theme.space.lg,
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
    color: theme.color.accentStrong,
    fontWeight: "600",
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
