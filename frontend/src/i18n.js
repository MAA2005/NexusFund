import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./locales/en.json";
import ar from "./locales/ar.json";
import fr from "./locales/fr.json";
import sw from "./locales/sw.json";

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: en },
            ar: { translation: ar },
            fr: { translation: fr },
            sw: { translation: sw },
        },
        fallbackLng: "en",
        supportedLngs: ["en", "ar", "fr", "sw"],
        detection: {
            // Check localStorage first, then browser language
            order: ["localStorage", "navigator"],
            caches: ["localStorage"],
            lookupLocalStorage: "nexusfund_lang",
        },
        interpolation: {
            // React already escapes values — no need for i18next to do it too
            escapeValue: false,
        },
    });

export default i18n;
