export enum Role {
  CUSTOMER = "customer",
  STAFF = "staff",
  ADMIN = "admin",
  GYM_PARTNER = "gym_partner",
  CORPORATE_ADMIN = "corporate_admin",
}

export enum ActivityLevel {
  SEDENTARY = "sedentary",
  LIGHT = "light",
  MODERATE = "moderate",
  ACTIVE = "active",
  VERY_ACTIVE = "very_active",
}

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

export interface CustomerProfile {
  userId: string;
  age?: number;
  gender?: string;
  heightCm?: number;
  weightKg?: number;
  activityLevel?: ActivityLevel;
  goal?: string;
}

export interface MenuItemSummary {
  id: string;
  name: string;
  priceCents: number;
  portionWeightG: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  imageUrl?: string;
}

export type OrderStatus = "pending" | "confirmed" | "ready" | "completed" | "cancelled";

/**
 * Kitchen workflow. The API enforces it; the admin UI uses it to decide
 * which buttons to show. Paid-online orders additionally can't be
 * cancelled until refunds exist (enforced server-side).
 */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["ready", "cancelled"],
  ready: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

/** The 14 allergens that EU Regulation 1169/2011 requires food sellers to declare. */
export const ALLERGENS = [
  { code: "gluten", label: "Γλουτένη" },
  { code: "crustaceans", label: "Καρκινοειδή" },
  { code: "eggs", label: "Αυγά" },
  { code: "fish", label: "Ψάρια" },
  { code: "peanuts", label: "Αράπικα φιστίκια" },
  { code: "soy", label: "Σόγια" },
  { code: "milk", label: "Γάλα" },
  { code: "nuts", label: "Ξηροί καρποί" },
  { code: "celery", label: "Σέλινο" },
  { code: "mustard", label: "Μουστάρδα" },
  { code: "sesame", label: "Σουσάμι" },
  { code: "sulphites", label: "Θειώδη" },
  { code: "lupin", label: "Λούπινο" },
  { code: "molluscs", label: "Μαλάκια" },
] as const;

export type AllergenCode = (typeof ALLERGENS)[number]["code"];
export const ALLERGEN_CODES: readonly string[] = ALLERGENS.map((a) => a.code);

export function allergenLabel(code: string): string {
  return ALLERGENS.find((a) => a.code === code)?.label ?? code;
}

/** Short code the customer shows at pickup and the kitchen sees on the ticket. */
export function pickupCode(orderId: string): string {
  return orderId.replace(/-/g, "").slice(0, 6).toUpperCase();
}

/** Dish labels an admin sets explicitly. Never inferred from dish names. */
export const DIET_TAGS = [
  { code: "vegetarian", label: "Χορτοφαγικό" },
  { code: "vegan", label: "Vegan" },
] as const;
export type DietTag = (typeof DIET_TAGS)[number]["code"];
export const DIET_TAG_CODES: readonly string[] = DIET_TAGS.map((t) => t.code);

export const MEAL_GOALS = [
  { code: "lose_weight", label: "Απώλεια βάρους" },
  { code: "maintain", label: "Διατήρηση βάρους" },
  { code: "gain_muscle", label: "Μυϊκή μάζα" },
  { code: "eat_healthier", label: "Πιο ισορροπημένη διατροφή" },
] as const;
export type MealGoal = (typeof MEAL_GOALS)[number]["code"];
