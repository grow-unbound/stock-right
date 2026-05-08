// Design tokens as JS constants for mobile (GlueStack) consumption.
// Source of truth: design-system/colors_and_type.css
// These mirror the CSS custom properties exactly.

export const tokens = {
  // Surfaces — light mode
  bgPage: "#FEFCF8",
  bgSurface: "#FFFFFF",
  bgSubtle: "#F5F0E8",
  bgInset: "#EDE6D9",

  // Text
  textPrimary: "#1C1A16",
  textSecondary: "#4A4237",
  textTertiary: "#7A6F61",
  textPlaceholder: "#C0B8B0",
  textOnBrand: "#FFFFFF",

  // Brand — two-token system
  brandUi: "#C8712A",
  brandUiHover: "#AD5E1F",
  brandUiPress: "#9A5418",
  brandText: "#8C4A12",
  brandSubtle: "#F5E8D8",
  brandBorder: "#E0B08A",

  // Semantic states
  inward: "#0B7B6E",
  inwardBg: "#E6F5F3",
  inwardBorder: "#A8DDD7",

  outward: "#A83422",
  outwardBg: "#F7EAE7",
  outwardBorder: "#E0B8B0",

  pending: "#7B5200",
  pendingBg: "#FAF2D9",
  pendingBorder: "#E0CC88",

  // Borders
  borderDefault: "#E5DED2",
  borderStrong: "#C9BFB0",
  focusRing: "rgba(200, 113, 42, 0.12)",

  // Dark mode surfaces
  dmBgPage: "#12100B",
  dmBgSurface: "#1F1C14",
  dmBgSubtle: "#2C281C",
  dmBgInset: "#3A3325",

  // Dark mode text
  dmTextPrimary: "#F0EBE0",
  dmTextSecondary: "#C4BAA8",
  dmTextTertiary: "#8A7F6E",
  dmTextOnBrand: "#2A1F12",

  // Dark mode brand
  dmBrandUi: "#E8943A",
  dmBrandText: "#E8943A",

  // Dark mode semantic
  dmInward: "#34C4AD",
  dmOutward: "#E8705A",
  dmPending: "#D4A020",

  // Spacing (4px grid)
  sp1: 4,
  sp2: 8,
  sp3: 12,
  sp4: 16,
  sp5: 20,
  sp6: 24,
  sp8: 32,
  sp10: 40,
  sp12: 48,
  sp16: 64,

  // Radius
  radiusSm: 4,
  radiusMd: 8,
  radiusLg: 12,
  radiusXl: 16,
  radiusPill: 9999,

  // Component sizing
  touchTarget: 48,
  controlSm: 28,
  controlDefault: 36,
  controlLg: 42,
  topbarHeight: 52,
  sidenavWidth: 200,
  tabbarHeight: 64,
  /** Scroll padding above tab bar + FAB (mobile app tab screens) */
  dashboardScrollBottomInset: 96,

  // Typography
  fontDisplay: "Noto Serif",
  fontBody: "Noto Sans",
  fontMono: "Noto Sans Mono",

  // Font sizes (px)
  fsDisplay: 48,
  fsH1: 38,
  fsH2: 30,
  fsH3: 24,
  fsBody: 15,
  fsSmall: 13,
  fsLabel: 11,
  fsNumber: 38,
  fsInput: 16, // LOCKED — iOS auto-zoom prevention
} as const;

export type TokenKey = keyof typeof tokens;
