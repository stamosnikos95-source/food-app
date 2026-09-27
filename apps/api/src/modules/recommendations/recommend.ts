import { allergenLabel } from "@food-app/shared-types";

/**
 * Rule-based "what should I eat today?" (M4 v1). Pure and deterministic so
 * every rule is unit-tested. Safety rules are hard filters; everything else
 * only changes the ranking. Output is indicative, never medical advice.
 */

export interface RecProfile {
  age: number | null;
  gender: string | null;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: string | null;
  goal: string | null;
  budgetPerMealCents: number | null;
  dietaryPreferences: string[];
  excludedIngredients: string[];
  excludedAllergens: string[];
}

export interface RecMenuItem {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  calories: number;
  proteinG: number;
  fatG: number;
  allergens: string[];
  dietTags: string[];
}

export type GoalCode = "lose_weight" | "maintain" | "gain_muscle" | "eat_healthier";

export interface Ranked<T> {
  item: T;
  score: number;
  reasons: string[];
}

export interface Recommendation<T> {
  mealTargetKcal: number | null;
  goal: GoalCode;
  profileComplete: boolean;
  picks: Ranked<T>[];
  others: Ranked<T>[];
  excluded: { item: T; reasons: string[] }[];
}

const ACTIVITY_FACTOR: Record<string, number> = {
  sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9,
};
const GOAL_FACTOR: Record<GoalCode, number> = { lose_weight: 0.85, maintain: 1, gain_muscle: 1.1, eat_healthier: 1 };
const MAIN_MEAL_SHARE = 0.35; // a main meal is roughly a third of the day
const DAILY_FLOOR_KCAL = 1400; // never derive a very low target
const RECENT_PENALTY = 0.2; // enough to demote yesterday's top pick below a close second
const PICKS = 3;

/** Lowercase, accents stripped: "Πρωτεΐνη" -> "πρωτεινη". */
export const normalize = (text: string) =>
  text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

const GOAL_CODES: GoalCode[] = ["lose_weight", "maintain", "gain_muscle", "eat_healthier"];

/** Canonical codes from the app; tolerant of free-text goals saved earlier. */
export function goalOf(goal: string | null): GoalCode {
  if (goal && (GOAL_CODES as string[]).includes(goal)) return goal as GoalCode;
  const g = normalize(goal ?? "");
  if (/απωλει|αδυνατ|χασω|lose/.test(g)) return "lose_weight";
  if (/μυικ|μαζα|ογκο|πρωτειν|muscle|gain/.test(g)) return "gain_muscle";
  if (/ισορροπ|υγιειν|health/.test(g)) return "eat_healthier";
  return "maintain";
}

/**
 * Indicative energy for one main meal: Mifflin–St Jeor BMR x activity x goal,
 * floored, times the main-meal share. Adults only; null without the data.
 */
export function mealEnergyTarget(p: RecProfile): number | null {
  if (p.age == null || p.age < 18 || !p.heightCm || !p.weightKg) return null;
  const sexConstant = p.gender === "male" ? 5 : p.gender === "female" ? -161 : -78; // unspecified: midpoint
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + sexConstant;
  const activity = ACTIVITY_FACTOR[p.activityLevel ?? ""] ?? ACTIVITY_FACTOR.light;
  const daily = Math.max(DAILY_FLOOR_KCAL, bmr * activity * GOAL_FACTOR[goalOf(p.goal)]);
  return Math.round((daily * MAIN_MEAL_SHARE) / 10) * 10;
}

// Free-text exclusions -> EU allergen codes. Over-matching is intentional:
// excluding one dish too many is safe, recommending one too many is not.
const TERM_ALLERGENS: [RegExp, string[]][] = [
  [/γαλα|γαλακτ|λακτοζ|τυρ|φετα|γιαουρτ|βουτυρ|κρεμα|lactose|dairy|milk/, ["milk"]],
  [/ξηρ\S* καρπ|καρυδ|αμυγδαλ|φουντουκ|κασιου|nuts?\b/, ["nuts"]],
  [/φιστικ|peanut/, ["peanuts", "nuts"]],
  [/θαλασσιν|seafood/, ["crustaceans", "molluscs"]],
  [/γαριδ|καβουρ|αστακ|καρκινοειδ/, ["crustaceans"]],
  [/μυδ|καλαμαρ|χταποδ|σουπι|μαλακι/, ["molluscs"]],
  [/ψαρ|fish/, ["fish"]],
  [/γλουτεν|σιταρ|gluten/, ["gluten"]],
  [/αυγ|egg/, ["eggs"]],
  [/σουσαμ|ταχιν|sesame/, ["sesame"]],
  [/σογι|soy/, ["soybeans"]],
  [/σελιν|celery/, ["celery"]],
  [/μουσταρδ|mustard/, ["mustard"]],
  [/λουπιν|lupin/, ["lupin"]],
  [/θειωδ|sulphite|sulfite/, ["sulphites"]],
];

const allergensFor = (term: string) =>
  TERM_ALLERGENS.filter(([re]) => re.test(term)).flatMap(([, codes]) => codes);

const formatPrice = (cents: number) => `${(cents / 100).toFixed(2).replace(".", ",")} €`;
const grams = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));

function dietRequirement(prefs: string[]): "vegan" | "vegetarian" | null {
  const all = prefs.map(normalize);
  if (all.some((p) => /vegan|βιγκαν/.test(p))) return "vegan";
  if (all.some((p) => /vegetarian|χορτοφαγ/.test(p))) return "vegetarian";
  return null;
}

function exclusionReasons(item: RecMenuItem, p: RecProfile, diet: "vegan" | "vegetarian" | null): string[] {
  const reasons: string[] = [];
  const text = normalize(`${item.name} ${item.description ?? ""}`);

  // Allergens: explicit codes, plus those implied by free-text exclusions and
  // "χωρίς ..." / "... free" preferences.
  const avoid = new Set(p.excludedAllergens);
  p.excludedIngredients.forEach((t) => allergensFor(normalize(t)).forEach((a) => avoid.add(a)));
  p.dietaryPreferences
    .map(normalize)
    .filter((t) => /χωρις|free/.test(t))
    .forEach((t) => allergensFor(t).forEach((a) => avoid.add(a)));
  for (const a of item.allergens) if (avoid.has(a)) reasons.push(`Περιέχει ${allergenLabel(a).toLowerCase()}`);

  for (const term of p.excludedIngredients.map(normalize)) {
    if (term.length >= 3 && text.includes(term)) reasons.push(`Αναφέρει «${term}», που έχεις αποκλείσει`);
  }

  if (diet === "vegan" && !item.dietTags.includes("vegan")) reasons.push("Δεν είναι σημειωμένο ως vegan");
  if (diet === "vegetarian" && !item.dietTags.some((t) => t === "vegetarian" || t === "vegan")) {
    reasons.push("Δεν είναι σημειωμένο ως χορτοφαγικό");
  }

  if (p.budgetPerMealCents != null && item.priceCents > p.budgetPerMealCents) {
    reasons.push(`Πάνω από το budget σου (${formatPrice(item.priceCents)})`);
  }
  return [...new Set(reasons)];
}

function rank<T extends RecMenuItem>(item: T, target: number | null, goal: GoalCode, p: RecProfile, recent: Set<string>): Ranked<T> {
  const kcal = Math.max(item.calories, 1);
  const proteinPer100Kcal = (item.proteinG / kcal) * 100;
  const proteinScore = Math.min(1, proteinPer100Kcal / 10);
  const fatShare = (item.fatG * 9) / kcal;
  const balanced = fatShare >= 0.2 && fatShare <= 0.35;
  const balance = balanced ? 1 : Math.max(0, 1 - Math.abs(fatShare - 0.275) * 4);
  const energyFit = target ? Math.exp(-Math.abs(kcal - target) / (0.25 * target)) : 0.6;

  const w =
    goal === "gain_muscle" ? { e: 0.35, p: 0.5, b: 0.15 }
    : goal === "lose_weight" ? { e: 0.55, p: 0.3, b: 0.15 }
    : { e: 0.45, p: 0.3, b: 0.25 };
  let score = w.e * energyFit + w.p * proteinScore + w.b * balance;

  const reasons: string[] = [];
  if (target && energyFit >= 0.7) reasons.push(`Κοντά στον ενδεικτικό στόχο σου (~${target} kcal)`);
  if (proteinPer100Kcal >= 6) reasons.push(`Πλούσιο σε πρωτεΐνη (${grams(item.proteinG)} g)`);
  if (balanced) reasons.push("Ισορροπημένα λιπαρά");
  if (p.budgetPerMealCents != null) reasons.push("Μέσα στο budget σου");
  if (recent.has(item.id)) {
    score -= RECENT_PENALTY;
    reasons.push("Το πήρες πρόσφατα, οπότε μπαίνει πιο χαμηλά για ποικιλία");
  }
  return { item, score: Math.round(score * 1000) / 1000, reasons };
}

export function recommend<T extends RecMenuItem>(menu: T[], profile: RecProfile, recentItemIds: Set<string>): Recommendation<T> {
  const goal = goalOf(profile.goal);
  const target = mealEnergyTarget(profile);
  const diet = dietRequirement(profile.dietaryPreferences);

  const suitable: Ranked<T>[] = [];
  const excluded: { item: T; reasons: string[] }[] = [];
  for (const item of menu) {
    const reasons = exclusionReasons(item, profile, diet);
    if (reasons.length) excluded.push({ item, reasons });
    else suitable.push(rank(item, target, goal, profile, recentItemIds));
  }
  // Highest score first; ties broken by name for a stable order.
  suitable.sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name, "el"));

  return {
    mealTargetKcal: target,
    goal,
    profileComplete: Boolean(profile.age && profile.heightCm && profile.weightKg && profile.activityLevel),
    picks: suitable.slice(0, PICKS),
    others: suitable.slice(PICKS),
    excluded,
  };
}
