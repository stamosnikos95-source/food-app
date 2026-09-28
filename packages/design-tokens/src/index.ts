/**
 * Shared design tokens for the food app.
 * Consumed by apps/admin-web (Tailwind theme) and apps/mobile (theme object).
 *
 * Direction: premium, minimal food-ordering app. White base, crisp near-black
 * text, one vivid emerald accent, photography first. Greek-native sans
 * (Commissioner) throughout.
 */

export const color = {
  background: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceRaised: "#F5F7F5", // quiet grey-green for grouped sections

  textPrimary: "#101512",
  textSecondary: "#4B544E",
  textMuted: "#8A928C",

  accent: "#0E8A4F", // vivid emerald: actions, prices in focus
  accentStrong: "#0A6B3D",
  accentSoft: "#E7F5ED",

  highlight: "#C77D1A", // allergens & warnings, warm amber

  border: "#E8ECE9",
  borderStrong: "#D3D9D5",

  danger: "#D23B2C",
  success: "#0E8A4F",
} as const;

export const typography = {
  // One family name per weight: custom fonts on iOS/Android don't reliably
  // synthesize weights from `fontWeight`, so never combine these with it.
  // Both families ship full Greek (see apps/mobile/assets/fonts/README.md).
  fontDisplay: "Commissioner_600SemiBold", // modern app titles (Piazzolla stays loaded for the wordmark)
  fontBody: "Commissioner_400Regular",
  fontBodyMedium: "Commissioner_500Medium",
  fontBodySemiBold: "Commissioner_600SemiBold",
  scale: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 20,
    xl: 24,
    "2xl": 32,
    "3xl": 40,
  },
  lineHeight: {
    tight: 1.2,
    body: 1.45,
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
  sm: 6,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export const tokens = { color, typography, space, radius };
export type DesignTokens = typeof tokens;
