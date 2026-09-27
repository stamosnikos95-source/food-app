import * as Joi from "joi";

/**
 * Validated at boot by @nestjs/config. If a required variable is missing
 * or malformed, the app fails fast with a clear error instead of behaving
 * unpredictably at runtime.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid("development", "test", "production").default("development"),
  PORT: Joi.number().default(3000),

  DATABASE_URL: Joi.string()
    .uri({ scheme: ["postgres", "postgresql"] })
    .required(),

  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default("15m"),

  // Refresh tokens are opaque random values stored hashed in the database
  // (not JWTs), so they need a lifetime but no signing secret.
  REFRESH_TOKEN_TTL_DAYS: Joi.number().integer().min(1).max(90).default(30),

  // Where the customer app lives; payment redirects return here.
  APP_URL: Joi.string()
    .uri({ scheme: ["https", "http"] })
    .default("https://food-app-mobile-web.onrender.com"),

  // Optional: without it the API runs normally and online payment is simply
  // reported as unavailable. A malformed value disables payments (logged)
  // rather than crashing the whole API. Set directly in the hosting
  // provider's environment settings; never commit it.
  STRIPE_SECRET_KEY: Joi.string().trim().optional(),
  STRIPE_WEBHOOK_SECRET: Joi.string().trim().optional(),

  // Comma-separated emails of EXISTING accounts to grant admin at startup.
  // VAT included in menu prices; food cost % is computed on the net price.
  MENU_VAT_PERCENT: Joi.number().min(0).max(30).default(13),

  // Loyalty (M8): points per euro the customer pays; a reward costs
  // LOYALTY_REWARD_POINTS and takes LOYALTY_REWARD_VALUE_CENTS off an order.
  LOYALTY_POINTS_PER_EURO: Joi.number().integer().min(0).max(100).default(1),
  LOYALTY_REWARD_POINTS: Joi.number().integer().min(1).max(100000).default(100),
  LOYALTY_REWARD_VALUE_CENTS: Joi.number().integer().min(1).max(100000).default(500),

  ADMIN_EMAILS: Joi.string().allow("").optional(),
});
