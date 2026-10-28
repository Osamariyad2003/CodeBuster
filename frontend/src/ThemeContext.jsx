import React, { createContext, useContext, useState, useEffect } from 'react';

export const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    const isDark = theme === 'dark';

    // Remove old conflicting class and add current
    root.classList.remove(isDark ? 'light' : 'dark');
    root.classList.add(theme);

    // Bootstrap 5.3 & custom CSS theme attributes
    root.setAttribute('data-bs-theme', theme);
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;

    // Persist to localStorage
    localStorage.setItem('theme', theme);

    // Update body background and text color to match CodeRabbit obsidian
    document.body.style.backgroundColor = isDark ? '#07080C' : '#F8FAFC';
    document.body.style.color = isDark ? '#F8FAFC' : '#0F172A';
  }, [theme]);

  const toggleTheme = () => {
    setThemeState(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const setTheme = (newTheme) => {
    if (newTheme === 'dark' || newTheme === 'light') {
      setThemeState(newTheme);
    }
  };

  const isDark = theme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    const fallbackTheme = localStorage.getItem('theme') || 'dark';
    const noop = () => {};
    const res = [fallbackTheme, noop];
    res.theme = fallbackTheme;
    res.toggleTheme = noop;
    res.setTheme = noop;
    res.isDark = fallbackTheme === 'dark';
    return res;
  }
  const result = [context.theme, context.toggleTheme];
  result.theme = context.theme;
  result.toggleTheme = context.toggleTheme;
  result.setTheme = context.setTheme;
  result.isDark = context.isDark;
  return result;
};
