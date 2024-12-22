import React, { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext();

export function useLanguage() {
  return useContext(LanguageContext);
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    // Try to get the language from localStorage first
    const savedLanguage = localStorage.getItem('language');
    return savedLanguage || 'en'; // Default to English
  });

  useEffect(() => {
    // Save language preference to localStorage when it changes
    localStorage.setItem('language', language);
    // Set HTML lang attribute
    document.documentElement.lang = language;
  }, [language]);

  const value = {
    language,
    setLanguage,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
