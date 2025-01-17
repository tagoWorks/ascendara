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
            // First change i18n's language
            await i18n.changeLanguage(targetLang);
            // Then update our state
            setLanguage(targetLang);
          } else {
            console.warn(`Failed to load language ${targetLang}, falling back to English`);
            await i18n.changeLanguage('en');
            setLanguage('en');
          }
        } else {
          // No language in settings, initialize with browser language
          const browserLang = getClosestSupportedLanguage(navigator.language);
          const success = await loadLanguageAsync(browserLang);
          if (success) {
            await i18n.changeLanguage(browserLang);
            setLanguage(browserLang);
          } else {
            await i18n.changeLanguage('en');
            setLanguage('en');
          }
        }
      } catch (error) {
        console.error('Error loading language from settings:', error);
        // Fall back to English on error
        await i18n.changeLanguage('en');
        setLanguage('en');
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
        // Change i18n's language
        await i18n.changeLanguage(newLanguage);
        
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
        i18n.changeLanguage(prevLang);
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
