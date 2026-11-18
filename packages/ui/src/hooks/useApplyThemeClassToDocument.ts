/**
 * @atlas
 * @kind hook
 * @partOf primitive:ui
 * @uses none
 */
import type { Theme } from '@template/ui/store/types/ui';
import { useEffect } from 'react';

export const useApplyThemeClassToDocument = (theme: Theme) => {
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', prefersDark);
    }
  }, [theme]);
};
