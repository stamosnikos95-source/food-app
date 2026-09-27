import { goalOf, mealEnergyTarget, normalize, recommend, RecMenuItem, RecProfile } from "./recommend";

const profile = (p: Partial<RecProfile> = {}): RecProfile => ({
  age: null, gender: null, heightCm: null, weightKg: null, activityLevel: null, goal: null,
  budgetPerMealCents: null, dietaryPreferences: [], excludedIngredients: [], excludedAllergens: [], ...p,
});
const dish = (p: Partial<RecMenuItem> & { id: string }): RecMenuItem => ({
  name: p.id, description: null, priceCents: 800, calories: 500, proteinG: 30, fatG: 15, allergens: [], dietTags: [], ...p,
});

const bowl = dish({ id: "bowl", name: "Bowl κοτόπουλο", description: "Ψητό κοτόπουλο, κινόα, σάλτσα γιαουρτιού", calories: 540, proteinG: 42, fatG: 18, allergens: ["milk"], priceCents: 850 });
const salmon = dish({ id: "salmon", name: "Σολομός", description: "Ψητός σολομός", calories: 610, proteinG: 38, fatG: 28, allergens: ["fish"], priceCents: 980 });
const lentils = dish({ id: "lentils", name: "Vegan bowl με φακές", calories: 480, proteinG: 22, fatG: 14, dietTags: ["vegan", "vegetarian"], priceCents: 750 });
const buddha = dish({ id: "buddha", name: "Buddha bowl", description: "χούμους, ταχίνι", calories: 500, proteinG: 18, fatG: 20, allergens: ["sesame"], dietTags: ["vegan", "vegetarian"], priceCents: 780 });
const menu = [bowl, salmon, lentils, buddha];

describe("normalize / goalOf", () => {
  it("strips accents and lowercases Greek", () => expect(normalize("  Πρωτεΐνη ")).toBe("πρωτεινη"));
  it("accepts canonical codes and older free-text goals", () => {
    expect(goalOf("gain_muscle")).toBe("gain_muscle");
    expect(goalOf("Περισσότερη πρωτεΐνη")).toBe("gain_muscle");
    expect(goalOf("απώλεια βάρους")).toBe("lose_weight");
    expect(goalOf(null)).toBe("maintain");
  });
});

describe("mealEnergyTarget (indicative, Mifflin–St Jeor)", () => {
  it("computes a main-meal share for an adult", () => {
    // BMR 1712.5 x 1.55 = 2654 kcal/day; x 0.35 = 929 -> 930
    expect(mealEnergyTarget(profile({ age: 34, gender: "male", heightCm: 178, weightKg: 76.5, activityLevel: "moderate" }))).toBe(930);
    // BMR 1320.25 x 1.375 x 0.85 = 1543; x 0.35 = 540
    expect(mealEnergyTarget(profile({ age: 30, gender: "female", heightCm: 165, weightKg: 60, activityLevel: "light", goal: "lose_weight" }))).toBe(540);
  });
  it("never derives a target from a very low daily estimate", () => {
    expect(mealEnergyTarget(profile({ age: 60, gender: "female", heightCm: 150, weightKg: 45, activityLevel: "sedentary", goal: "lose_weight" }))).toBe(490);
  });
  it("gives no target for minors or incomplete profiles", () => {
    expect(mealEnergyTarget(profile({ age: 16, heightCm: 170, weightKg: 60 }))).toBeNull();
    expect(mealEnergyTarget(profile({ age: 30, weightKg: 60 }))).toBeNull();
  });
});

describe("recommend — safety filters", () => {
  const ids = (xs: { item: RecMenuItem }[]) => xs.map((x) => x.item.id);

  it("never recommends a dish with an excluded allergen, and says why", () => {
    const r = recommend(menu, profile({ excludedAllergens: ["milk"] }), new Set());
    expect(ids([...r.picks, ...r.others])).not.toContain("bowl");
    expect(r.excluded.find((e) => e.item.id === "bowl")?.reasons).toEqual(["Περιέχει γάλα"]);
  });

  it("maps free-text exclusions and 'χωρίς …' preferences to allergens", () => {
    const r = recommend(menu, profile({ excludedIngredients: ["Ψάρι"], dietaryPreferences: ["Χωρίς λακτόζη"] }), new Set());
    expect(ids(r.excluded).sort()).toEqual(["bowl", "salmon"]);
  });

  it("excludes dishes whose name or description mentions an excluded ingredient", () => {
    const r = recommend(menu, profile({ excludedIngredients: ["κοτόπουλο"] }), new Set());
    expect(r.excluded.find((e) => e.item.id === "bowl")?.reasons).toContain("Αναφέρει «κοτοπουλο», που έχεις αποκλείσει");
  });

  it("uses explicit diet tags, never dish names, for vegetarian and vegan", () => {
    const veg = recommend(menu, profile({ dietaryPreferences: ["vegetarian"] }), new Set());
    expect(ids([...veg.picks, ...veg.others]).sort()).toEqual(["buddha", "lentils"]);
    const untaggedVeg = recommend([dish({ id: "moussaka", name: "Χορτοφαγικός μουσακάς" })], profile({ dietaryPreferences: ["vegan"] }), new Set());
    expect(untaggedVeg.excluded[0].reasons).toEqual(["Δεν είναι σημειωμένο ως vegan"]);
  });

  it("treats the per-meal budget as a hard limit", () => {
    const r = recommend(menu, profile({ budgetPerMealCents: 800 }), new Set());
    expect(ids(r.excluded).sort()).toEqual(["bowl", "salmon"]);
    expect(r.excluded.find((e) => e.item.id === "salmon")?.reasons).toEqual(["Πάνω από το budget σου (9,80 €)"]);
    expect(r.picks.every((p) => p.reasons.includes("Μέσα στο budget σου"))).toBe(true);
  });
});

describe("recommend — ranking", () => {
  it("favours protein for a muscle-gain goal and explains it", () => {
    const r = recommend(menu, profile({ goal: "gain_muscle" }), new Set());
    expect(r.picks[0].item.id).toBe("bowl");
    expect(r.picks[0].reasons).toContain("Πλούσιο σε πρωτεΐνη (42 g)");
  });

  it("returns at most three picks, the rest in order", () => {
    const r = recommend(menu, profile(), new Set());
    expect(r.picks).toHaveLength(3);
    expect(r.others).toHaveLength(1);
    expect(r.picks[0].score).toBeGreaterThanOrEqual(r.picks[1].score);
  });

  it("moves a dish ordered recently further down, for variety", () => {
    const fresh = recommend(menu, profile({ goal: "gain_muscle" }), new Set());
    const after = recommend(menu, profile({ goal: "gain_muscle" }), new Set(["bowl"]));
    expect(fresh.picks[0].item.id).toBe("bowl");
    expect(after.picks[0].item.id).not.toBe("bowl");
    expect([...after.picks, ...after.others].find((x) => x.item.id === "bowl")?.reasons).toContain(
      "Το πήρες πρόσφατα, οπότε μπαίνει πιο χαμηλά για ποικιλία",
    );
  });

  it("reports whether the profile is complete enough for a target", () => {
    expect(recommend(menu, profile(), new Set()).profileComplete).toBe(false);
    // No sex given: the equation's midpoint constant is used (1629.5 x 1.55 x 0.35 = 884 -> 880).
    const full = recommend(menu, profile({ age: 34, heightCm: 178, weightKg: 76.5, activityLevel: "moderate" }), new Set());
    expect(full.profileComplete).toBe(true);
    expect(full.mealTargetKcal).toBe(880);
  });
});
