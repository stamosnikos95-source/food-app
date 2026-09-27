import type { OrderStatus } from "@food-app/shared-types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://food-app-api-6glo.onrender.com/api/v1";

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

export interface TokenPair { accessToken: string; refreshToken: string }

export interface AdminOrder {
  id: string;
  status: OrderStatus;
  totalPriceCents: number;
  createdAt: string;
  customerEmail: string;
  paidOnline: boolean;
  items: { id: string; quantity: number; menuItem: { name: string; allergens: string[] } }[];
}

export interface AdminMenuItem {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  priceCents: number;
  portionWeightG: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  allergens: string[];
  isActive: boolean;
}

export type MenuItemInput = Omit<AdminMenuItem, "id" | "description" | "category"> & {
  description?: string;
  category?: string;
};

export interface Ingredient {
  id: string;
  name: string;
  costPerKgCents: number;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  allergens: string[];
  isActive: boolean;
}
export type IngredientInput = Omit<Ingredient, "id">;
export interface RecipeView {
  id: string;
  name: string;
  yieldPortions: number;
  notes: string | null;
  menuItem: { id: string; name: string; priceCents: number } | null;
  lines: { ingredientId: string; name: string; grams: number; costCents: number }[];
  costing: {
    batchWeightG: number;
    perPortion: { weightG: number; calories: number; proteinG: number; carbsG: number; fatG: number; costCents: number };
    allergens: string[];
  };
  vatPercent: number;
  foodCostPercent: number | null;
}
export interface RecipeInput {
  name: string;
  yieldPortions: number;
  menuItemId: string | null;
  notes?: string;
  lines: { ingredientId: string; grams: number }[];
}
export interface SalesSummary {
  orders: number;
  revenueCents: number;
  averageOrderCents: number;
  paidOnlineCents: number;
  byStatus: Partial<Record<OrderStatus, number>>;
  topItems: { menuItemId: string; name: string; quantity: number }[];
}

async function request<T>(path: string, init: { method?: string; body?: unknown; token?: string } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: init.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError("network", 0);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(data.message) ? data.message.join(", ") : data.message;
    throw new ApiError(message ?? response.statusText, response.status);
  }
  return data as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<TokenPair>("/auth/login", { method: "POST", body: { email, password } }),
  refresh: (refreshToken: string) =>
    request<TokenPair>("/auth/refresh", { method: "POST", body: { refreshToken } }),
  logout: (refreshToken: string) =>
    request<void>("/auth/logout", { method: "POST", body: { refreshToken } }),

  activeOrders: (token: string) => request<AdminOrder[]>("/admin/orders?status=active", { token }),
  setOrderStatus: (token: string, id: string, status: OrderStatus) =>
    request<AdminOrder>(`/admin/orders/${id}/status`, { method: "PATCH", body: { status }, token }),

  menu: (token: string) => request<AdminMenuItem[]>("/admin/menu", { token }),
  createMenuItem: (token: string, body: MenuItemInput) =>
    request<AdminMenuItem>("/admin/menu", { method: "POST", body, token }),
  updateMenuItem: (token: string, id: string, body: Partial<MenuItemInput>) =>
    request<AdminMenuItem>(`/admin/menu/${id}`, { method: "PATCH", body, token }),

  ingredients: (token: string) => request<Ingredient[]>("/admin/ingredients", { token }),
  createIngredient: (token: string, body: IngredientInput) =>
    request<Ingredient>("/admin/ingredients", { method: "POST", body, token }),
  updateIngredient: (token: string, id: string, body: Partial<IngredientInput>) =>
    request<Ingredient>(`/admin/ingredients/${id}`, { method: "PATCH", body, token }),

  recipes: (token: string) => request<RecipeView[]>("/admin/recipes", { token }),
  createRecipe: (token: string, body: RecipeInput) =>
    request<RecipeView>("/admin/recipes", { method: "POST", body, token }),
  updateRecipe: (token: string, id: string, body: Partial<RecipeInput>) =>
    request<RecipeView>(`/admin/recipes/${id}`, { method: "PATCH", body, token }),
  applyRecipe: (token: string, id: string) =>
    request<AdminMenuItem>(`/admin/recipes/${id}/apply-to-menu`, { method: "POST", token }),

  summary: (token: string, from: Date, to: Date) =>
    request<SalesSummary>(
      `/admin/reports/summary?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
      { token },
    ),
};

/** Greek, user-facing copy for any error; `specific` overrides by status. */
export function describeError(error: unknown, specific: Record<number, string> = {}): string {
  if (error instanceof ApiError) {
    if (specific[error.status]) return specific[error.status];
    if (error.status === 0) return "Δεν υπάρχει σύνδεση με τον server — αν είχε ώρα να χρησιμοποιηθεί, ξυπνάει. Δοκίμασε ξανά σε λίγα δευτερόλεπτα.";
    if (error.status === 401) return "Η σύνδεση έληξε. Συνδέσου ξανά.";
    if (error.status === 403) return "Ο λογαριασμός σου δεν έχει δικαίωμα για αυτή την ενέργεια.";
    if (error.status === 409) return error.message;
    if (error.status >= 500) return "Πρόβλημα στον server. Δοκίμασε ξανά σε λίγο.";
  }
  return "Κάτι πήγε στραβά. Δοκίμασε ξανά.";
}
