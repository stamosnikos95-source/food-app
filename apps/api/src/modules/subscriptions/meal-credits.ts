/**
 * How much of an order meal-plan credits cover: one credit per portion,
 * most expensive portions first (best for the customer), each capped at the
 * plan's per-meal limit. Returns the credits actually used.
 */
export function mealCredits(lines: { unitPriceCents: number; quantity: number }[], requested: number, capCents: number) {
  const portions = lines.flatMap((l) => Array<number>(l.quantity).fill(l.unitPriceCents)).sort((a, b) => b - a);
  const used = Math.max(0, Math.min(requested, portions.length));
  const cents = portions.slice(0, used).reduce((sum, price) => sum + Math.min(price, capCents), 0);
  return { meals: used, cents };
}
