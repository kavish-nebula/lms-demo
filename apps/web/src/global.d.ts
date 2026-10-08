import type en from "@lms/i18n/en.json";

// Type-check every t("...") key against the base catalog.
declare module "next-intl" {
  interface AppConfig {
    Messages: typeof en;
  }
}
