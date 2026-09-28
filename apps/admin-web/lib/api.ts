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
  companyPaidCents?: number;
  subscriptionCoveredCents?: number;
  loyaltyDiscountCents?: number;
  gymDiscountCents?: number;
  fulfillment?: "store" | "gym";
  gym?: { name: string } | null;
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
  dietTags: string[];
  imageUrl?: string | null;
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
  reorderLevelG?: number | null;
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
export type StaffRole = "customer" | "staff" | "admin";
export interface AdminCustomer {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  company: { id: string; name: string } | null;
  orders: number;
  spentCents: number;
  lastOrderAt: string | null;
}
export interface AdminCustomerDetail extends AdminCustomer {
  loyaltyPoints: number;
  recentOrders: {
    id: string;
    status: OrderStatus;
    totalPriceCents: number;
    companyPaidCents: number;
    createdAt: string;
    items: { quantity: number; menuItem: { name: string } }[];
  }[];
}
export interface CustomerPage { total: number; page: number; pageSize: number; customers: AdminCustomer[] }
export interface CompanyFields {
  name: string;
  vatNumber: string;
  billingEmail: string;
  contactName: string | null;
  phone: string | null;
  address: string | null;
  dailyAllowanceCents: number;
  isActive: boolean;
}
export interface CompanySummary extends CompanyFields { id: string; members: number; monthToDateCents: number }
export interface CompanyDetail extends CompanyFields { id: string; members: { userId: string; email: string; since: string }[] }
export interface CompanyStatement {
  company: { id: string; name: string; vatNumber: string; billingEmail: string };
  month: string;
  orders: { id: string; createdAt: string; employee: string; totalPriceCents: number; companyPaidCents: number }[];
  totals: { orders: number; companyCents: number; employeeCents: number };
}
export interface InventoryItem {
  id: string;
  name: string;
  isActive: boolean;
  stockG: number;
  reorderLevelG: number | null;
  costPerKgCents: number;
  valueCents: number;
  low: boolean;
  needsCount: boolean;
  expiringOn: string | null;
  lastMovementAt: string | null;
}
export interface InventoryOverview { items: InventoryItem[]; totals: { valueCents: number; low: number; expiring: number } }
export type Confidence = "high" | "medium" | "low" | "none";
export interface DishPlan {
  menuItem: { id: string; name: string };
  hasRecipe: boolean;
  predicted: number | null;
  recommended: number | null;
  observations: number;
  spread: number | null;
  confidence: Confidence;
  basis: string;
}
export interface ProductionPlan {
  date: string;
  weekday: string;
  modelVersion: string;
  openDaysSeen: number;
  dishes: DishPlan[];
  ingredients: { ingredientId: string; name: string; requiredG: number; stockG: number; shortfallG: number }[];
}
export interface WasteReport {
  from: string;
  to: string;
  dishes: { name: string; portions: number; costCents: number }[];
  ingredients: { name: string; grams: number; costCents: number }[];
  totals: { dishCostCents: number; ingredientCostCents: number; wastedPortions: number; producedPortions: number; wastePercent: number | null };
}
export interface Plan {
  id: string;
  name: string;
  description: string | null;
  mealsPerPeriod: number;
  periodDays: number;
  priceCents: number;
  maxMealPriceCents: number;
  isActive: boolean;
}
export interface AdminSubscription {
  id: string;
  status: "pending" | "active" | "cancelled";
  mealsRemaining: number;
  currentPeriodEnd: string | null;
  lastPaidAt: string | null;
  createdAt: string;
  plan: Plan;
  user: { email: string };
}
export interface GymCode {
  id: string;
  gymId: string;
  code: string;
  label: string;
  isActive: boolean;
  scans: number;
  url: string;
}
export interface GymFields {
  name: string;
  address: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  discountPercent: number;
  commissionPercent: number;
  deliveryEnabled: boolean;
  deliveryNote: string | null;
  isActive: boolean;
}
export interface Gym extends GymFields { id: string; orders: number; codes: GymCode[] }
export interface GymReport {
  gym: { id: string; name: string; commissionPercent: number; discountPercent: number };
  month: string;
  orders: number;
  deliveredToGym: number;
  netSalesCents: number;
  memberDiscountCents: number;
  commissionCents: number;
  codes: { id: string; label: string; isActive: boolean; scans: number; orders: number }[];
}
export interface Analytics {
  from: string;
  to: string;
  days: number;
  totals: { orders: number; netSalesCents: number; averageOrderCents: number };
  series: { date: string; orders: number; netCents: number }[];
  weekdays: { weekday: string; avgOrders: number }[];
  topDishes: { name: string; quantity: number; revenueCents: number }[];
  customers: { active: number; returning: number; new: number };
  channels: { viaGym: number; employerSubsidised: number; mealPlan: number; loyaltyReward: number };
  combos: { aName: string; bName: string; count: number; support: number; confidenceAB: number; lift: number }[];
  recommendations: { shown: number; ordered: number; conversion: number | null };
  forecastAccuracy: { observations: number; meanAbsoluteError: number; bias: number; meanAbsolutePercentError: number | null } | null;
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

  customers: (token: string, search: string, page: number) =>
    request<CustomerPage>(`/admin/customers?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ""}`, { token }),
  customer: (token: string, id: string) => request<AdminCustomerDetail>(`/admin/customers/${id}`, { token }),
  setRole: (token: string, id: string, role: StaffRole) =>
    request<AdminCustomerDetail>(`/admin/customers/${id}/role`, { method: "PATCH", body: { role }, token }),

  companies: (token: string) => request<CompanySummary[]>("/admin/companies", { token }),
  company: (token: string, id: string) => request<CompanyDetail>(`/admin/companies/${id}`, { token }),
  createCompany: (token: string, body: Partial<CompanyFields>) =>
    request<CompanyDetail>("/admin/companies", { method: "POST", body, token }),
  updateCompany: (token: string, id: string, body: Partial<CompanyFields>) =>
    request<CompanyDetail>(`/admin/companies/${id}`, { method: "PATCH", body, token }),
  addMember: (token: string, id: string, email: string) =>
    request<CompanyDetail>(`/admin/companies/${id}/members`, { method: "POST", body: { email }, token }),
  removeMember: (token: string, id: string, userId: string) =>
    request<CompanyDetail>(`/admin/companies/${id}/members/${userId}`, { method: "DELETE", token }),
  statement: (token: string, id: string, month: string) =>
    request<CompanyStatement>(`/admin/companies/${id}/statement?month=${month}`, { token }),

  inventory: (token: string) => request<InventoryOverview>("/admin/inventory", { token }),
  purchase: (token: string, body: { ingredientId: string; quantityG: number; costPerKgCents?: number; expiresOn?: string; note?: string }) =>
    request<unknown>("/admin/inventory/purchases", { method: "POST", body, token }),
  ingredientWaste: (token: string, body: { ingredientId: string; quantityG: number; reason: string; note?: string }) =>
    request<unknown>("/admin/inventory/waste", { method: "POST", body, token }),
  stockCount: (token: string, body: { ingredientId: string; countedG: number; note?: string }) =>
    request<{ countedG: number; previousG: number; adjustedByG: number }>("/admin/inventory/count", { method: "POST", body, token }),
  planning: (token: string, date?: string) => request<ProductionPlan>(`/admin/planning${date ? `?date=${date}` : ""}`, { token }),
  recordProduction: (token: string, body: { menuItemId: string; portions: number; date?: string }) =>
    request<{ deductedStock: boolean }>("/admin/production", { method: "POST", body, token }),
  recordLeftover: (token: string, body: { menuItemId: string; portions: number; reason: string; date?: string }) =>
    request<unknown>("/admin/production/leftovers", { method: "POST", body, token }),
  wasteReport: (token: string, days = 7) => request<WasteReport>(`/admin/waste?days=${days}`, { token }),

  plans: (token: string) => request<Plan[]>("/admin/plans", { token }),
  createPlan: (token: string, body: Omit<Plan, "id">) => request<Plan>("/admin/plans", { method: "POST", body, token }),
  updatePlan: (token: string, id: string, body: Partial<Omit<Plan, "id">>) => request<Plan>(`/admin/plans/${id}`, { method: "PATCH", body, token }),
  subscriptions: (token: string, status?: string) =>
    request<AdminSubscription[]>(`/admin/subscriptions${status ? `?status=${status}` : ""}`, { token }),
  activateSubscription: (token: string, id: string) => request<AdminSubscription>(`/admin/subscriptions/${id}/activate`, { method: "POST", token }),
  cancelSubscription: (token: string, id: string) => request<AdminSubscription>(`/admin/subscriptions/${id}/cancel`, { method: "POST", token }),
  adjustPoints: (token: string, customerId: string, points: number, note: string) =>
    request<{ balance: number }>(`/admin/customers/${customerId}/points`, { method: "POST", body: { points, note }, token }),

  gyms: (token: string) => request<Gym[]>("/admin/gyms", { token }),
  createGym: (token: string, body: Partial<GymFields>) => request<Gym>("/admin/gyms", { method: "POST", body, token }),
  updateGym: (token: string, id: string, body: Partial<GymFields>) => request<Gym>(`/admin/gyms/${id}`, { method: "PATCH", body, token }),
  createGymCode: (token: string, gymId: string, label: string) =>
    request<GymCode>(`/admin/gyms/${gymId}/codes`, { method: "POST", body: { label }, token }),
  setGymCode: (token: string, codeId: string, isActive: boolean) =>
    request<GymCode>(`/admin/gym-codes/${codeId}`, { method: "PATCH", body: { isActive }, token }),
  gymReport: (token: string, gymId: string, month: string) => request<GymReport>(`/admin/gyms/${gymId}/report?month=${month}`, { token }),

  analytics: (token: string, days: number) => request<Analytics>(`/admin/analytics?days=${days}`, { token }),

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
