import { useAppStore } from '@template/ui/store';
import { useEffect } from 'react';

export const useThemePersistence = () => {
  const theme = useAppStore((state) => state.ui.theme);
  const setTheme = useAppStore((state) => state.ui.setTheme);

  // Hydrate theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'system' | null;
    if (savedTheme) setTheme(savedTheme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist theme changes to localStorage
  useEffect(() => {
    localStorage.setItem('theme', theme);
  }, [theme]);
};
