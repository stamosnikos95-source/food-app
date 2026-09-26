const API_BASE_URL = "https://food-app-api-6glo.onrender.com/api/v1";

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  accessToken?: string | null;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    // The free Render plan spins the service down after 15 minutes idle;
    // the first request after that can take up to ~60s to wake it up.
    throw new ApiError("Network request failed", 0);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = Array.isArray(data.message) ? data.message.join(", ") : data.message;
    // Server messages are developer-facing (English); screens map status
    // codes to user-facing Greek copy via describeError().
    throw new ApiError(message ?? response.statusText, response.status);
  }

  return data as T;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface Profile {
  userId: string;
  age: number | null;
  gender: string | null;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: string | null;
  goal: string | null;
  budgetPerMealCents: number | null;
  dietaryPreferences: string[];
  excludedIngredients: string[];
}

export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  portionWeightG: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  imageUrl: string | null;
  isActive: boolean;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  quantity: number;
  unitPriceCents: number;
  menuItem: MenuItem;
}

export interface Order {
  id: string;
  status: "pending" | "confirmed" | "ready" | "completed" | "cancelled";
  totalPriceCents: number;
  createdAt: string;
  items: OrderItem[];
}

export const api = {
  register: (email: string, password: string) =>
    request<TokenPair>("/auth/register", { method: "POST", body: { email, password } }),

  refresh: (refreshToken: string) =>
    request<TokenPair>("/auth/refresh", { method: "POST", body: { refreshToken } }),

  logout: (refreshToken: string) =>
    request<void>("/auth/logout", { method: "POST", body: { refreshToken } }),

  login: (email: string, password: string) =>
    request<TokenPair>("/auth/login", { method: "POST", body: { email, password } }),

  getProfile: (accessToken: string) =>
    request<Profile>("/users/me/profile", { accessToken }),

  updateProfile: (accessToken: string, patch: Partial<Profile>) =>
    request<Profile>("/users/me/profile", { method: "PATCH", body: patch, accessToken }),

  getMenu: (accessToken: string) => request<MenuItem[]>("/menu", { accessToken }),

  createOrder: (accessToken: string, items: { menuItemId: string; quantity: number }[]) =>
    request<Order>("/orders", { method: "POST", body: { items }, accessToken }),

  getOrders: (accessToken: string) => request<Order[]>("/orders", { accessToken }),

  getPaymentsConfig: () =>
    request<{ onlinePaymentsEnabled: boolean; mode: "test" | "live" | "disabled" }>(
      "/payments/config",
    ),

  startCheckout: (accessToken: string, orderId: string) =>
    request<{ checkoutUrl: string }>("/payments/checkout", {
      method: "POST",
      body: { orderId },
      accessToken,
    }),

  confirmCheckout: (accessToken: string, sessionId: string) =>
    request<Order>("/payments/confirm", { method: "POST", body: { sessionId }, accessToken }),
};
