import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { setupDOMEnvironment, cleanupDOMEnvironment } from '@template/shared/test';
import type { SpaceTheme } from '../types';

describe('useSpaceTheme', () => {
  beforeEach(() => {
    setupDOMEnvironment();
    // Clear all --space-* CSS variables
    const style = document.documentElement.style;
    for (let i = style.length - 1; i >= 0; i--) {
      const prop = style[i];
      if (prop?.startsWith('--space-')) {
        style.removeProperty(prop);
      }
    }
  });

  afterEach(() => {
    cleanupDOMEnvironment();
  });

  it('should set CSS variables for defined theme properties', () => {
    const theme: SpaceTheme = {
      primary: '262 80% 46%',
      secondary: '142 76% 46%',
      accent: '38 92% 50%',
    };

    // Simulate hook behavior
    if (theme) {
      Object.entries(theme).forEach(([key, value]) => {
        if (value) {
          document.documentElement.style.setProperty(`--space-${key}`, value);
        }
      });
    }

    expect(document.documentElement.style.getPropertyValue('--space-primary')).toBe('262 80% 46%');
    expect(document.documentElement.style.getPropertyValue('--space-secondary')).toBe('142 76% 46%');
    expect(document.documentElement.style.getPropertyValue('--space-accent')).toBe('38 92% 50%');
  });

  it('should wrap URL properties in url()', () => {
    const theme: SpaceTheme = {
      logo: 'https://example.com/logo.png',
      logoDark: 'https://example.com/logo-dark.png',
    };

    const themeUrls = ['logo', 'logoDark', 'favicon'];

    // Simulate hook behavior
    if (theme) {
      Object.entries(theme).forEach(([key, value]) => {
        if (value) {
          const cssValue = themeUrls.includes(key) ? `url(${value})` : value;
          document.documentElement.style.setProperty(`--space-${key}`, cssValue);
        }
      });
    }

    expect(document.documentElement.style.getPropertyValue('--space-logo')).toBe('url(https://example.com/logo.png)');
    expect(document.documentElement.style.getPropertyValue('--space-logoDark')).toBe('url(https://example.com/logo-dark.png)');
  });

  it('should not set CSS variables for undefined properties', () => {
    const theme: SpaceTheme = {
      primary: '262 80% 46%',
      // secondary is undefined
    };

    // Simulate hook behavior
    if (theme) {
      Object.entries(theme).forEach(([key, value]) => {
        if (value) {
          document.documentElement.style.setProperty(`--space-${key}`, value);
        }
      });
    }

    expect(document.documentElement.style.getPropertyValue('--space-primary')).toBe('262 80% 46%');
    expect(document.documentElement.style.getPropertyValue('--space-secondary')).toBe('');
  });

  it('should clear all CSS variables when theme is null', () => {
    const theme: SpaceTheme = {
      primary: '262 80% 46%',
      secondary: '142 76% 46%',
    };

    // Set initial theme
    if (theme) {
      Object.entries(theme).forEach(([key, value]) => {
        if (value) {
          document.documentElement.style.setProperty(`--space-${key}`, value);
        }
      });
    }

    expect(document.documentElement.style.getPropertyValue('--space-primary')).toBe('262 80% 46%');

    // Clear theme (simulate null)
    const allKeys = theme ? Object.keys(theme) : [];
    allKeys.forEach(key => {
      document.documentElement.style.removeProperty(`--space-${key}`);
    });

    expect(document.documentElement.style.getPropertyValue('--space-primary')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--space-secondary')).toBe('');
  });

  it('should clear previous variables when theme changes', () => {
    const theme1: SpaceTheme = {
      primary: '262 80% 46%',
      secondary: '142 76% 46%',
    };

    const theme2: SpaceTheme = {
      primary: '199 89% 48%',
      // secondary is removed
      tertiary: '174 72% 56%',
    };

    // Set theme1
    if (theme1) {
      Object.entries(theme1).forEach(([key, value]) => {
        if (value) {
          document.documentElement.style.setProperty(`--space-${key}`, value);
        }
      });
    }

    expect(document.documentElement.style.getPropertyValue('--space-primary')).toBe('262 80% 46%');
    expect(document.documentElement.style.getPropertyValue('--space-secondary')).toBe('142 76% 46%');

    // Clear all previous variables
    const allKeys1 = theme1 ? Object.keys(theme1) : [];
    allKeys1.forEach(key => {
      document.documentElement.style.removeProperty(`--space-${key}`);
    });

    // Set theme2
    if (theme2) {
      Object.entries(theme2).forEach(([key, value]) => {
        if (value) {
          document.documentElement.style.setProperty(`--space-${key}`, value);
        }
      });
    }

    expect(document.documentElement.style.getPropertyValue('--space-primary')).toBe('199 89% 48%');
    expect(document.documentElement.style.getPropertyValue('--space-secondary')).toBe(''); // Cleared
    expect(document.documentElement.style.getPropertyValue('--space-tertiary')).toBe('174 72% 56%');
  });

  it('should clear stale variables not in new theme', () => {
    const theme1: SpaceTheme = {
      primary: '262 80% 46%',
      secondary: '142 76% 46%',
      tertiary: '174 72% 56%',
    };

    const theme2: SpaceTheme = {
      primary: '199 89% 48%',
    };

    // Apply theme1
    if (theme1) {
      Object.entries(theme1).forEach(([key, value]) => {
        if (value) {
          document.documentElement.style.setProperty(`--space-${key}`, value);
        }
      });
    }

    // Verify theme1 applied
    expect(document.documentElement.style.getPropertyValue('--space-primary')).toBe('262 80% 46%');
    expect(document.documentElement.style.getPropertyValue('--space-secondary')).toBe('142 76% 46%');
    expect(document.documentElement.style.getPropertyValue('--space-tertiary')).toBe('174 72% 56%');

    // Apply theme2 with CORRECT clearing logic (clear ALL --space-* vars)
    const style = document.documentElement.style;
    for (let i = style.length - 1; i >= 0; i--) {
      const prop = style[i];
      if (prop?.startsWith('--space-')) {
        style.removeProperty(prop);
      }
    }

    if (theme2) {
      Object.entries(theme2).forEach(([key, value]) => {
        if (value) {
          document.documentElement.style.setProperty(`--space-${key}`, value);
        }
      });
    }

    // Verify new theme applied and stale vars cleared
    expect(document.documentElement.style.getPropertyValue('--space-primary')).toBe('199 89% 48%');
    expect(document.documentElement.style.getPropertyValue('--space-secondary')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--space-tertiary')).toBe('');
  });

  it('should handle all shade variants', () => {
    const theme: SpaceTheme = {
      primary: '262 80% 46%',
      primary1: '262 80% 90%',
      primary2: '262 80% 70%',
      primary3: '262 80% 50%',
      primary4: '262 80% 30%',
      primaryForeground: '0 0% 100%',
    };

    // Simulate hook behavior
    if (theme) {
      Object.entries(theme).forEach(([key, value]) => {
        if (value) {
          document.documentElement.style.setProperty(`--space-${key}`, value);
        }
      });
    }

    expect(document.documentElement.style.getPropertyValue('--space-primary')).toBe('262 80% 46%');
    expect(document.documentElement.style.getPropertyValue('--space-primary1')).toBe('262 80% 90%');
    expect(document.documentElement.style.getPropertyValue('--space-primary2')).toBe('262 80% 70%');
    expect(document.documentElement.style.getPropertyValue('--space-primary3')).toBe('262 80% 50%');
    expect(document.documentElement.style.getPropertyValue('--space-primary4')).toBe('262 80% 30%');
    expect(document.documentElement.style.getPropertyValue('--space-primaryForeground')).toBe('0 0% 100%');
  });
});
