import * as Joi from "joi";

/**
 * Validated at boot by @nestjs/config. If a required variable is missing
 * or malformed, the app fails fast with a clear error instead of behaving
 * unpredictably at runtime.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid("development", "test", "production").default("development"),
  PORT: Joi.number().default(3000),

  DATABASE_URL: Joi.string().uri({ scheme: [/postgres/] }).required(),

  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default("15m"),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default("7d"),
});
