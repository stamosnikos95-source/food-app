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
