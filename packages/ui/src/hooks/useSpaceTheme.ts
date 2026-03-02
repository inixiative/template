import { useEffect, useRef } from 'react';
import type { SpaceTheme } from '@template/ui/types';

const themeUrls = ['logo', 'logoDark', 'favicon'];

export const useSpaceTheme = (spaceTheme: SpaceTheme) => {
  const previousThemeKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const style = document.documentElement.style;

    // Clear previously applied keys first so stale values cannot persist.
    for (const key of previousThemeKeysRef.current) {
      style.removeProperty(`--space-${key}`);
    }
    previousThemeKeysRef.current.clear();

    if (spaceTheme) {
      Object.entries(spaceTheme).forEach(([key, value]) => {
        if (value) {
          const cssValue = themeUrls.includes(key) ? `url(${value})` : value;
          style.setProperty(`--space-${key}`, cssValue);
          previousThemeKeysRef.current.add(key);
        }
      });
    }
  }, [spaceTheme]);
};
