import { tokens } from "@stockright/shared/tokens";
import { createConfig } from "@gluestack-style/react";

export const gluestackConfig = createConfig({
  tokens: {
    colors: {
      // Brand
      brandUi: tokens.brandUi,
      brandText: tokens.brandText,
      brandSubtle: tokens.brandSubtle,
      // Semantic
      inward: tokens.inward,
      inwardBg: tokens.inwardBg,
      outward: tokens.outward,
      outwardBg: tokens.outwardBg,
      pending: tokens.pending,
      pendingBg: tokens.pendingBg,
      // Backgrounds
      bgPage: tokens.bgPage,
      bgSurface: tokens.bgSurface,
      bgSubtle: tokens.bgSubtle,
      // Text
      textPrimary: tokens.textPrimary,
      textSecondary: tokens.textSecondary,
      textTertiary: tokens.textTertiary,
      textPlaceholder: tokens.textPlaceholder,
      textOnBrand: tokens.textOnBrand,
      // Borders
      borderDefault: tokens.borderDefault,
      borderStrong: tokens.borderStrong,
    },
    fontSizes: {
      "2xs": 10,
      xs: 11,
      sm: 12,
      md: 13,
      lg: 14,
      xl: 15,
      "2xl": 16,
      "3xl": 18,
      "4xl": 20,
      "5xl": 22,
      "6xl": 24,
      input: tokens.fsInput, // 16 — LOCKED for iOS zoom prevention
    },
    space: {
      "0": 0,
      "1": 4,
      "2": 8,
      "3": 12,
      "4": 16,
      "5": 20,
      "6": 24,
      "8": 32,
      "10": 40,
      "12": 48, // touch target minimum
    },
    radii: {
      sm: tokens.radiusSm,
      md: tokens.radiusMd,
      lg: tokens.radiusLg,
      xl: tokens.radiusXl,
      "2xl": 20,
      full: 9999,
    },
  },
  aliases: {
    bg: "backgroundColor",
    p: "padding",
    px: "paddingHorizontal",
    py: "paddingVertical",
    rounded: "borderRadius",
  },
});

export type AppConfig = typeof gluestackConfig;
