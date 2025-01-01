import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enOriginal from './translations/en-original.json';
import ar from './translations/ar.json';
import bn from './translations/bn.json';
import es from './translations/es.json';
import hi from './translations/hi.json';
import ja from './translations/ja.json';
import pt from './translations/pt.json';
import ru from './translations/ru.json';
import zhCN from './translations/zh-CN.json';

// Available languages with their labels
export const languages = {
  en: { name: 'English', nativeName: 'English' },
  ar: { name: 'Arabic', nativeName: 'العربية' },
  bn: { name: 'Bengali', nativeName: 'বাংলা' },
  es: { name: 'Spanish', nativeName: 'Español' },
  hi: { name: 'Hindi', nativeName: 'हिन्दी' },
  ja: { name: 'Japanese', nativeName: '日本語' },
  pt: { name: 'Portuguese', nativeName: 'Português' },
  ru: { name: 'Russian', nativeName: 'Русский' },
  'zh-CN': { name: 'Chinese (Simplified)', nativeName: '简体中文' }
};

// Function to check if a language is supported
export const isSupportedLanguage = (lang) => {
  return lang in languages;
};

// Function to get the closest supported language
export const getClosestSupportedLanguage = (lang) => {
  if (!lang) return 'en';
  if (isSupportedLanguage(lang)) return lang;
  
  // Try to match language without region code
  const baseLang = lang.split('-')[0];
  const match = Object.keys(languages).find(code => code.startsWith(baseLang));
  return match || 'en';
};

// Initialize i18next with local translations
i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enOriginal },
      ar: { translation: ar },
      bn: { translation: bn },
      es: { translation: es },
      hi: { translation: hi },
      ja: { translation: ja },
      pt: { translation: pt },
      ru: { translation: ru },
      'zh-CN': { translation: zhCN }
    },
    lng: getClosestSupportedLanguage(navigator.language),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    },
    react: {
      useSuspense: false // This helps prevent loading flickers
    }
  });

// Function to load a language asynchronously
export const loadLanguageAsync = async (language) => {
  try {
    const targetLang = getClosestSupportedLanguage(language);
    if (!targetLang) {
      console.warn(`Language ${language} is not supported`);
      return false;
    }

    // Change the language
    await i18n.changeLanguage(targetLang);
    
    // Update HTML lang attribute
    document.documentElement.lang = targetLang;
    
    return true;
  } catch (error) {
    console.error(`Failed to load language ${language}:`, error);
    return false;
  }
};

export default i18n;