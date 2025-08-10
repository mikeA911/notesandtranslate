import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translations
import en from './locales/en.json';
import lo from './locales/lo.json';
import km from './locales/km.json';

// Language resources
const resources = {
  en: { translation: en },
  lo: { translation: lo },
  km: { translation: km }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'ui_language',
      caches: ['localStorage']
    },

    interpolation: {
      escapeValue: false // React already does escaping
    },

    react: {
      useSuspense: false
    }
  });

export default i18n;