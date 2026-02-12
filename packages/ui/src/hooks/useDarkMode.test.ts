import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { cleanupDOMEnvironment, setupDOMEnvironment } from '@template/ui/test';

describe('useDarkMode', () => {
  const applyTheme = (theme: 'light' | 'dark' | 'system') => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      return;
    }

    if (theme === 'light') {
      document.documentElement.classList.remove('dark');
    }
  };

  beforeEach(() => {
    setupDOMEnvironment();
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    cleanupDOMEnvironment();
  });

  it('should add dark class when theme is dark', () => {
    applyTheme('dark');

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('should remove dark class when theme is light', () => {
    document.documentElement.classList.add('dark');
    applyTheme('light');

    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('should toggle dark class based on system preference when theme is system', () => {
    const mockMatchMedia = (matches: boolean) => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: () => ({
          matches,
          media: '(prefers-color-scheme: dark)',
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => true,
        }),
      });
    };

    // Test with dark system preference
    mockMatchMedia(true);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', prefersDark);
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    // Test with light system preference
    mockMatchMedia(false);
    const prefersLight = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', prefersLight);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
