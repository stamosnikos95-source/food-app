/**
 * Shared design tokens for the food app.
 * Consumed by apps/admin-web (Tailwind theme) and apps/mobile (theme object).
 *
 * Direction: premium, minimal food brand. Warm neutral base, one grounded
 * accent (moss/olive, not the common warm-cream + terracotta combination),
 * confident but quiet typography. No gradients, no "AI dashboard" chrome.
 */

export const color = {
  // Warm, slightly stone-toned neutral base (not pure white, not #F4F1EA cream)
  background: "#F2F0E6",
  surface: "#FBFAF6",
  surfaceRaised: "#FFFFFF",

  // Text
  textPrimary: "#20241E", // near-black with a green cast, not generic #111
  textSecondary: "#5B6157",
  textMuted: "#8B8F82",

  // Accent: deep moss / olive, used sparingly
  accent: "#465C3E",
  accentStrong: "#2E3E29",
  accentSoft: "#DDE5D3",

  // A single secondary accent for highlights (e.g. "today's pick")
  highlight: "#B4823B",

  border: "#DEDACB",
  borderStrong: "#C4BFA9",

  danger: "#A23B2E",
  success: "#3F6B45",
} as const;

export const typography = {
  fontDisplay: "'Fraunces', Georgia, serif",
  fontBody: "'Work Sans', 'Segoe UI', sans-serif",
  scale: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 20,
    xl: 24,
    "2xl": 32,
    "3xl": 40,
  },
  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
  },
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  "2xl": 48,
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 16,
  pill: 999,
} as const;

export const tokens = { color, typography, space, radius };
export type DesignTokens = typeof tokens;
