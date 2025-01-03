import React, { createContext, useContext, useState, useEffect } from 'react';
import { ThemeProvider as NextThemeProvider, useTheme as useNextTheme } from 'next-themes'

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('purple');

  useEffect(() => {
    // Load theme from settings on mount
    const loadTheme = async () => {
      try {
        const settings = await window.electron.getSettings();
        if (settings?.theme) {
          setThemeState(settings.theme);
        }
      } catch (error) {
        console.error('Error loading theme from settings:', error);
      }
    };
    loadTheme();

    // Listen for settings changes
    const handleSettingsChange = (event, settings) => {
      if (settings?.theme) {
        setThemeState(settings.theme);
      }
    };

    window.electron.ipcRenderer.on('settings-updated', handleSettingsChange);

    return () => {
      window.electron.ipcRenderer.off('settings-updated', handleSettingsChange);
    };
  }, []);

  const setTheme = (newTheme) => {
    setThemeState(newTheme);
  };

  return (
    <NextThemeProvider 
      attribute="data-theme" 
      defaultTheme="purple" 
      enableSystem={false} 
      forcedTheme={theme}
      themes={['light', 'dark', 'midnight', 'cyberpunk', 'sunset', 'forest', 'blue', 'purple', 'emerald', 'rose']}
    >
      <ThemeContext.Provider value={{ theme, setTheme }}>
        {children}
      </ThemeContext.Provider>
    </NextThemeProvider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}