import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import i18n, { loadLanguageAsync, languages, getClosestSupportedLanguage } from '../i18n';

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    // Default to browser language or English
    return getClosestSupportedLanguage(navigator.language);
  });

  // Initialize language from electron settings
  useEffect(() => {
    const initLanguage = async () => {
      try {
        const settings = await window.electron.getSettings();
        if (settings?.language) {
          const targetLang = getClosestSupportedLanguage(settings.language);
          const success = await loadLanguageAsync(targetLang);
          if (success) {
            setLanguage(targetLang);
          } else {
            console.warn(`Failed to load language ${targetLang}, falling back to English`);
            setLanguage('en');
          }
        }
      } catch (error) {
        console.error('Error loading language from settings:', error);
      }
    };
    initLanguage();
  }, []);

  // Subscribe to i18next language changes
  useEffect(() => {
    const handleLanguageChanged = (lng) => {
      setLanguage(lng);
    };

    i18n.on('languageChanged', handleLanguageChanged);
    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, []);

  useEffect(() => {
    // Set HTML lang attribute
    document.documentElement.lang = language;
  }, [language]);

  const changeLanguage = useCallback(async (newLanguage) => {
    try {
      const success = await loadLanguageAsync(newLanguage);
      if (success) {
        // Save to electron settings
        const settings = await window.electron.getSettings();
        await window.electron.saveSettings({
          ...settings,
          language: newLanguage
        });
      } else {
        throw new Error(`Failed to load language ${newLanguage}`);
      }
    } catch (error) {
      console.error('Error updating language:', error);
      // Revert to previous language on error
      setLanguage(prevLang => {
        loadLanguageAsync(prevLang);
        return prevLang;
      });
    }
  }, []);

  const value = {
    language,
    changeLanguage,
    languages,
    t: i18n.t.bind(i18n)
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
