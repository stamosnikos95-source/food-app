import { costRecipe, foodCostPercent, CostingIngredient } from "./recipe-costing";

const ing = (p: Partial<CostingIngredient>): CostingIngredient => ({
  kcalPer100g: 0, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 0, costPerKgCents: 0, allergens: [], ...p,
});
// Real-world-ish values: chicken breast, raw quinoa, strained yogurt.
const chicken = ing({ kcalPer100g: 165, proteinPer100g: 31, fatPer100g: 3.6, costPerKgCents: 850 });
const quinoa = ing({ kcalPer100g: 368, proteinPer100g: 14.1, carbsPer100g: 64.2, fatPer100g: 6.1, costPerKgCents: 600 });
const yogurt = ing({ kcalPer100g: 59, proteinPer100g: 10, carbsPer100g: 3.6, fatPer100g: 0.4, costPerKgCents: 400, allergens: ["milk"] });
const lines = [
  { grams: 150, ingredient: chicken },
  { grams: 80, ingredient: quinoa },
  { grams: 50, ingredient: yogurt },
];

describe("costRecipe", () => {
  it("computes per-portion nutrition, cost and allergens for a single portion", () => {
    const c = costRecipe(lines, 1);
    // kcal 1.5*165 + 0.8*368 + 0.5*59 = 571.4; protein 46.5 + 11.28 + 5 = 62.78
    expect(c.perPortion).toEqual({ weightG: 280, calories: 571, proteinG: 62.8, carbsG: 53.2, fatG: 10.5, costCents: 196 });
    expect(c.allergens).toEqual(["milk"]);
    expect(c.batchWeightG).toBe(280);
  });

  it("divides a batch by its yield", () => {
    const c = costRecipe(lines.map((l) => ({ ...l, grams: l.grams * 10 })), 10);
    expect(c.perPortion.calories).toBe(571);
    expect(c.perPortion.costCents).toBe(196);
    expect(c.batchWeightG).toBe(2800);
  });

  it("unions and sorts allergens across ingredients", () => {
    const c = costRecipe(
      [{ grams: 10, ingredient: ing({ allergens: ["sesame", "gluten"] }) }, { grams: 10, ingredient: ing({ allergens: ["gluten", "eggs"] }) }],
      1,
    );
    expect(c.allergens).toEqual(["eggs", "gluten", "sesame"]);
  });

  it("treats a zero or fractional yield as at least one portion", () => {
    expect(costRecipe(lines, 0).perPortion.calories).toBe(571);
    expect(costRecipe([], 3).perPortion).toEqual({ weightG: 0, calories: 0, proteinG: 0, carbsG: 0, fatG: 0, costCents: 0 });
  });
});

describe("foodCostPercent", () => {
  it("is computed on the price net of VAT", () => {
    // 8.50 incl. 13% VAT -> 7.52 net; 1.96 / 7.52 = 26.1%
    expect(foodCostPercent(196, 850, 13)).toBe(26.1);
    expect(foodCostPercent(196, 850, 0)).toBe(23.1);
  });

  it("is null for a zero price", () => {
    expect(foodCostPercent(100, 0, 13)).toBeNull();
  });
});
