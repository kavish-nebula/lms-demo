import { getRequestConfig } from "next-intl/server";
import en from "@lms/i18n/en.json";

/**
 * next-intl request configuration, without locale routing for now.
 * The locale will come from the user profile (ARCHITECTURE.pdf section 9)
 * once auth exists; until then every request uses the base language.
 * Add a locale by dropping <code>.json into packages/i18n and listing it here.
 */
export const BASE_LOCALE = "en";

const CATALOGS = { en } as const;
export type Locale = keyof typeof CATALOGS;
export const SUPPORTED_LOCALES = Object.keys(CATALOGS) as Locale[];

export default getRequestConfig(async () => {
  const locale: Locale = BASE_LOCALE;
  return { locale, messages: CATALOGS[locale], timeZone: "UTC" };
});
