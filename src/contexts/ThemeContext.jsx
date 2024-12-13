import React, { createContext, useContext, useState } from 'react';
import { ThemeProvider as NextThemeProvider, useTheme as useNextTheme } from 'next-themes'

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  return (
    <NextThemeProvider attribute="data-theme" defaultTheme="purple" themes={['light', 'dark', 'midnight', 'cyberpunk', 'sunset', 'forest', 'blue', 'purple', 'emerald', 'rose']}>
      {children}
    </NextThemeProvider>
  )
}

export function useTheme() {
  return useNextTheme()
} 