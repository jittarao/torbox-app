'use client';

import { createContext, useContext, useCallback, useSyncExternalStore } from 'react';

const ThemeContext = createContext();

// Subscribe to theme changes (listens for class changes on documentElement)
function subscribeToTheme(callback) {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.attributeName === 'class') {
        callback();
      }
    }
  });

  observer.observe(document.documentElement, { attributes: true });

  return () => observer.disconnect();
}

// Get current theme from DOM
function getThemeSnapshot() {
  return document.documentElement.classList.contains('dark');
}

// Server snapshot - always false (blocking script will set correct class before hydration)
function getServerSnapshot() {
  return false;
}

export function ThemeProvider({ children }) {
  // useSyncExternalStore properly handles SSR/hydration
  const darkMode = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerSnapshot);

  const toggleDarkMode = useCallback(() => {
    const newValue = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', newValue);
    localStorage.setItem('darkMode', String(newValue));
  }, []);

  const value = {
    darkMode,
    toggleDarkMode,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
