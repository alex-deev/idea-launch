import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enCommon from "./locales/en/common.json";
import enLanding from "./locales/en/landing.json";
import enAuth from "./locales/en/auth.json";
import esCommon from "./locales/es/common.json";
import esLanding from "./locales/es/landing.json";
import esAuth from "./locales/es/auth.json";

export const supportedLanguages = ["en", "es"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

export const resources = {
  en: {
    common: enCommon,
    landing: enLanding,
    auth: enAuth,
  },
  es: {
    common: esCommon,
    landing: esLanding,
    auth: esAuth,
  },
} as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    supportedLngs: [...supportedLanguages],
    defaultNS: "common",
    ns: ["common", "landing", "auth"],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "language",
    },
  });

export default i18n;
