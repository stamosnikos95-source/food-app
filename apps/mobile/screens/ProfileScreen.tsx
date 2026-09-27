import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { ALLERGENS, MEAL_GOALS } from "@food-app/shared-types";
import { Field } from "../components/Field";
import { ChipGroup } from "../components/ChipGroup";
import { PrimaryButton } from "../components/PrimaryButton";
import { Screen } from "../components/Screen";
import { useAuth } from "../auth/AuthContext";
import { api, Profile } from "../api/client";
import { describeError } from "../api/errors";
import { parseDecimal, upperGreek } from "../lib/format";
import { theme } from "../theme";

const ACTIVITY_LEVELS = [
  { value: "sedentary", label: "Καθιστική ζωή" },
  { value: "light", label: "Ελαφριά δραστηριότητα" },
  { value: "moderate", label: "Μέτρια δραστηριότητα" },
  { value: "active", label: "Δραστήριος/α" },
  { value: "very_active", label: "Πολύ δραστήριος/α" },
];
const GENDERS = [
  { value: "female", label: "Γυναίκα" },
  { value: "male", label: "Άνδρας" },
  { value: "", label: "Δεν δηλώνω" },
];
const DIETS = [
  { value: "", label: "Τρώω απ' όλα" },
  { value: "vegetarian", label: "Χορτοφάγος" },
  { value: "vegan", label: "Vegan" },
];
const DIET_CODES = ["vegetarian", "vegan"];
const GOAL_OPTIONS = MEAL_GOALS.map((g) => ({ value: g.code, label: g.label }));
const ALLERGEN_OPTIONS = ALLERGENS.map((a) => ({ value: a.code, label: a.label }));

const commaNumber = (n: number | null) => (n == null ? "" : String(n).replace(".", ","));
const splitList = (text: string) => text.split(",").map((s) => s.trim()).filter(Boolean);

export function ProfileScreen() {
  const { withAuth, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [activityLevel, setActivityLevel] = useState<string | null>(null);
  const [goal, setGoal] = useState<string | null>(null);
  const [diet, setDiet] = useState("");
  const [excludedAllergens, setExcludedAllergens] = useState<string[]>([]);
  const [otherExclusions, setOtherExclusions] = useState("");
  const [otherPreferences, setOtherPreferences] = useState("");
  const [budgetEuros, setBudgetEuros] = useState("");

  useEffect(() => {
    withAuth((token) => api.getProfile(token))
      .then((p: Profile) => {
        setAge(p.age?.toString() ?? "");
        setGender(p.gender ?? "");
        setHeightCm(p.heightCm?.toString() ?? "");
        setWeightKg(commaNumber(p.weightKg));
        setActivityLevel(p.activityLevel);
        setGoal(p.goal);
        setDiet(p.dietaryPreferences.find((d) => DIET_CODES.includes(d)) ?? "");
        setOtherPreferences(p.dietaryPreferences.filter((d) => !DIET_CODES.includes(d)).join(", "));
        setExcludedAllergens(p.excludedAllergens ?? []);
        setOtherExclusions(p.excludedIngredients.join(", "));
        setBudgetEuros(p.budgetPerMealCents != null ? (p.budgetPerMealCents / 100).toFixed(2).replace(".", ",") : "");
      })
      .catch((e) => setError(describeError(e)))
      .finally(() => setLoading(false));
  }, [withAuth]);

  function touch<T>(setter: (v: T) => void) {
    return (v: T) => {
      setSaved(false);
      setter(v);
    };
  }

  async function handleSave() {
    setError(null);
    setSaved(false);
    // Greek keyboards type decimal commas ("8,50"): parse them explicitly.
    const budget = parseDecimal(budgetEuros);
    const parsedAge = parseDecimal(age);
    const parsedHeight = parseDecimal(heightCm);
    setSaving(true);
    try {
      await withAuth((token) =>
        api.updateProfile(token, {
          age: parsedAge !== undefined ? Math.round(parsedAge) : undefined,
          gender: gender || null,
          heightCm: parsedHeight !== undefined ? Math.round(parsedHeight) : undefined,
          weightKg: parseDecimal(weightKg),
          activityLevel: activityLevel ?? undefined,
          goal: goal ?? undefined,
          budgetPerMealCents: budget !== undefined ? Math.round(budget * 100) : undefined,
          dietaryPreferences: [...(diet ? [diet] : []), ...splitList(otherPreferences)],
          excludedAllergens,
          excludedIngredients: splitList(otherExclusions),
        }),
      );
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
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title} accessibilityRole="header">
          Το προφίλ μου
        </Text>
        <Text style={styles.intro}>
          Με αυτά ο βοηθός διαλέγει πιάτα για σένα. Όλα είναι προαιρετικά, και οι προτάσεις είναι
          ενδεικτικές — όχι ιατρική ή διαιτολογική συμβουλή.
        </Text>

        <Text style={styles.section}>{upperGreek("Σωματικά στοιχεία")}</Text>
        <Field label="Ηλικία" value={age} onChangeText={touch(setAge)} keyboardType="number-pad" />
        <ChipGroup label="Φύλο" options={GENDERS} isSelected={(v) => v === gender} onPress={touch(setGender)} />
        <Field label="Ύψος (cm)" value={heightCm} onChangeText={touch(setHeightCm)} keyboardType="number-pad" />
        <Field label="Βάρος (kg)" value={weightKg} onChangeText={touch(setWeightKg)} keyboardType="decimal-pad" />
        <ChipGroup
          label="Επίπεδο δραστηριότητας"
          options={ACTIVITY_LEVELS}
          isSelected={(v) => v === activityLevel}
          onPress={touch(setActivityLevel)}
        />

        <Text style={styles.section}>{upperGreek("Στόχος")}</Text>
        <ChipGroup label="Τι θέλεις να πετύχεις;" options={GOAL_OPTIONS} isSelected={(v) => v === goal} onPress={touch(setGoal)} />

        <Text style={styles.section}>{upperGreek("Διατροφή")}</Text>
        <ChipGroup label="Διατροφή" options={DIETS} isSelected={(v) => v === diet} onPress={touch(setDiet)} />
        <ChipGroup
          label="Αλλεργίες & δυσανεξίες"
          hint="Πιάτα που τα περιέχουν δεν θα σου προτείνονται ποτέ. Για σοβαρή αλλεργία, επιβεβαίωνε και με το κατάστημα."
          options={ALLERGEN_OPTIONS}
          isSelected={(v) => excludedAllergens.includes(v)}
          onPress={(v) => {
            setSaved(false);
            setExcludedAllergens((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
          }}
        />
        <Field
          label="Άλλα που δεν τρως"
          value={otherExclusions}
          onChangeText={touch(setOtherExclusions)}
          placeholder="π.χ. μανιτάρια, κόλιανδρος"
        />
        <Field
          label="Άλλες προτιμήσεις"
          value={otherPreferences}
          onChangeText={touch(setOtherPreferences)}
          placeholder="π.χ. λιγότερο αλάτι"
        />

        <Text style={styles.section}>{upperGreek("Budget")}</Text>
        <Field
          label="Μέχρι πόσα θέλεις να δίνεις ανά γεύμα (€)"
          value={budgetEuros}
          onChangeText={touch(setBudgetEuros)}
          keyboardType="decimal-pad"
          placeholder="π.χ. 9,00"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {saved ? <Text style={styles.saved}>Αποθηκεύτηκε — οι προτάσεις ενημερώθηκαν.</Text> : null}

        <PrimaryButton title="Αποθήκευση" onPress={handleSave} loading={saving} />
        <View style={styles.logoutSpacing}>
          <PrimaryButton title="Αποσύνδεση" onPress={logout} variant="secondary" />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: {
    paddingHorizontal: theme.space.lg,
    paddingTop: theme.space.xl,
    paddingBottom: theme.space["2xl"],
  },
  title: {
    fontFamily: theme.typography.fontDisplay,
    fontSize: theme.typography.scale["2xl"],
    lineHeight: 38,
    color: theme.color.textPrimary,
  },
  intro: {
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.sm,
    lineHeight: 21,
    color: theme.color.textSecondary,
    marginTop: theme.space.xs,
    marginBottom: theme.space.md,
  },
  section: {
    fontFamily: theme.typography.fontBodyMedium,
    fontSize: theme.typography.scale.xs,
    letterSpacing: 1.2,
    color: theme.color.textMuted,
    marginTop: theme.space.md,
    marginBottom: theme.space.md,
  },
  error: {
    fontFamily: theme.typography.fontBody,
    fontSize: theme.typography.scale.sm,
    lineHeight: 20,
    color: theme.color.danger,
    marginBottom: theme.space.md,
  },
  saved: {
    fontFamily: theme.typography.fontBodyMedium,
    color: theme.color.success,
    marginBottom: theme.space.md,
  },
  logoutSpacing: { marginTop: theme.space.md },
});
