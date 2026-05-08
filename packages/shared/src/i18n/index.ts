import en from "./en/common.json";
import hi from "./hi/common.json";
import te from "./te/common.json";

export const translations = { en, te, hi } as const;
export type Locale = keyof typeof translations;
export type TranslationKeys = typeof en;

export const defaultLocale: Locale = "en";
export const supportedLocales: Locale[] = ["en", "te", "hi"];
