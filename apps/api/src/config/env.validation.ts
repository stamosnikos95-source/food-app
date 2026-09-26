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
});
