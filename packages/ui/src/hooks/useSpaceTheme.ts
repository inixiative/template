import { useEffect } from 'react';
import type { SpaceTheme } from '../types';

const themeUrls = ['logo', 'logoDark', 'favicon'];

export const useSpaceTheme = (spaceTheme: SpaceTheme) => {
  useEffect(() => {
    // Step 1: Clear ALL --space-* variables (prevents stale vars from previous theme)
    const style = document.documentElement.style;
    for (let i = style.length - 1; i >= 0; i--) {
      const prop = style[i];
      if (prop?.startsWith('--space-')) {
        style.removeProperty(prop);
      }
    }

    // Step 2: Set only the keys defined in the new theme
    if (spaceTheme) {
      Object.entries(spaceTheme).forEach(([key, value]) => {
        if (value) {
          const cssValue = themeUrls.includes(key) ? `url(${value})` : value;
          document.documentElement.style.setProperty(`--space-${key}`, cssValue);
        }
      });
    }
  }, [spaceTheme]);
};
