/**
 * Test Utilities for Component Testing
 *
 * Provides wrappers and utilities for testing React components
 * that depend on Zustand store or other context.
 */

import type { AppStore } from '@template/ui/store/types';
import { createTestStore } from '@template/ui/test/testStore';
import type { ReactNode } from 'react';

/**
 * Creates a test wrapper component with store context
 */
export const createTestWrapper = (initialState?: Partial<AppStore>) => {
  const _store = createTestStore(initialState);

  return ({ children }: { children: ReactNode }) => {
    // For now, just return children directly
    // When we need Provider context, we can add it here
    return children;
  };
};

/**
 * Mock DOM environment for hook testing.
 *
 * Layers a full interactive mock (classList, style, matchMedia) on top of
 * the minimal stub provided by test/setup.ts. Always replaces the stub —
 * the preload only exists so libraries like sonner can inject CSS at
 * module-load time without crashing.
 */
export const setupDOMEnvironment = () => {
  const classes = new Set<string>();
  const styles = new Map<string, string>();

  const classListMock = {
    add: (className: string) => classes.add(className),
    remove: (className: string) => classes.delete(className),
    contains: (className: string) => classes.has(className),
    toggle: (className: string, force?: boolean) => {
      if (force === undefined) {
        if (classes.has(className)) {
          classes.delete(className);
          return false;
        }
        classes.add(className);
        return true;
      }
      if (force) {
        classes.add(className);
        return true;
      }
      classes.delete(className);
      return false;
    },
    length: 0,
  };

  const styleMock = {
    setProperty: (prop: string, value: string) => styles.set(prop, value),
    removeProperty: (prop: string) => styles.delete(prop),
    getPropertyValue: (prop: string) => styles.get(prop) || '',
    length: styles.size,
    [Symbol.iterator]: function* () {
      for (const key of styles.keys()) {
        yield key;
      }
    },
  };

  const noop = () => {};
  const headEl = { appendChild: noop };

  (globalThis as Record<string, unknown>).document = {
    documentElement: {
      classList: classListMock,
      style: styleMock,
    },
    head: headEl,
    createElement: () => ({ classList: classListMock, style: styleMock, appendChild: noop, styleSheet: null }),
    createTextNode: (text: string) => ({ textContent: text }),
    getElementsByTagName: () => [headEl],
    appendChild: noop,
  };

  (globalThis as Record<string, unknown>).window = {
    matchMedia: () => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: noop,
      removeListener: noop,
      addEventListener: noop,
      removeEventListener: noop,
      dispatchEvent: () => true,
    }),
  };
};

/**
 * Cleanup DOM environment after tests
 */
export const cleanupDOMEnvironment = () => {
  if (typeof globalThis.document === 'undefined') return;

  try {
    // Remove dark class if present
    document.documentElement?.classList?.remove('dark');

    // Clear any custom CSS properties set by tests
    if (document.documentElement?.style) {
      const properties = Array.from(document.documentElement.style);
      properties.forEach((prop) => {
        if (prop.startsWith('--')) {
          document.documentElement.style.removeProperty(prop);
        }
      });
    }
  } catch (_e) {
    // Ignore cleanup errors in mock environment
  }
};
