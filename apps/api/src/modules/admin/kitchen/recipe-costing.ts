/** Pure costing maths, kept free of I/O so it can be tested exhaustively. */

export interface CostingIngredient {
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  costPerKgCents: number;
  allergens: string[];
}

export interface CostingLine {
  grams: number;
  ingredient: CostingIngredient;
}

export interface RecipeCosting {
  batchWeightG: number;
  perPortion: {
    weightG: number;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    costCents: number;
  };
  /** Union of every ingredient's allergens, sorted. */
  allergens: string[];
}

const round1 = (x: number) => Math.round(x * 10) / 10;

export function costRecipe(lines: CostingLine[], yieldPortions: number): RecipeCosting {
  const total = { weight: 0, kcal: 0, protein: 0, carbs: 0, fat: 0, cost: 0 };
  const allergens = new Set<string>();

  for (const { grams, ingredient: i } of lines) {
    const hundreds = grams / 100;
    total.weight += grams;
    total.kcal += hundreds * i.kcalPer100g;
    total.protein += hundreds * i.proteinPer100g;
    total.carbs += hundreds * i.carbsPer100g;
    total.fat += hundreds * i.fatPer100g;
    total.cost += (grams / 1000) * i.costPerKgCents;
    i.allergens.forEach((a) => allergens.add(a));
  }

  const n = Math.max(1, Math.floor(yieldPortions));
  return {
    batchWeightG: Math.round(total.weight),
    perPortion: {
      weightG: Math.round(total.weight / n),
      calories: Math.round(total.kcal / n),
      proteinG: round1(total.protein / n),
      carbsG: round1(total.carbs / n),
      fatG: round1(total.fat / n),
      costCents: Math.round(total.cost / n),
    },
    allergens: [...allergens].sort(),
  };
}

/**
 * Ingredient cost as a share of the NET selling price (menu prices include
 * VAT, which never reaches the business). Null when the price is zero.
 */
export function foodCostPercent(costCents: number, priceCents: number, vatPercent: number): number | null {
  if (priceCents <= 0) return null;
  const netPrice = priceCents / (1 + vatPercent / 100);
  return round1((costCents / netPrice) * 100);
}
