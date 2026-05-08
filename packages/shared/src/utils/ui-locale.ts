import { defaultLocale, type Locale, supportedLocales } from "../i18n";

export function parseUiLocale(value: string | null | undefined): Locale {
  if (!value) return defaultLocale;
  const v = value.toLowerCase().split("-")[0] ?? "";
  if (v === "te") return "te";
  if (v === "hi") return "hi";
  if (v === "en") return "en";
  return defaultLocale;
}

export function detectDefaultUiLocaleFromTag(languageTag: string | undefined): Locale {
  if (!languageTag) return defaultLocale;
  const base = languageTag.toLowerCase().split("-")[0] ?? "";
  if (base === "te") return "te";
  if (base === "hi") return "hi";
  return defaultLocale;
}

export const languagePickerOptions: {
  code: Locale;
  /** Primary label in the language itself */
  labelNative: string;
  /** Short hint in English (small / secondary) */
  labelEn: string;
}[] = [
  { code: "en", labelNative: "English", labelEn: "English" },
  { code: "te", labelNative: "తెలుగు", labelEn: "Telugu" },
  { code: "hi", labelNative: "हिंदी", labelEn: "Hindi" },
];

export function isSupportedLocale(x: string): x is Locale {
  return (supportedLocales as readonly string[]).includes(x);
}
