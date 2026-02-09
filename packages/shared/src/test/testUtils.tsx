/**
 * Test Utilities for Component Testing
 *
 * Provides wrappers and utilities for testing React components
 * that depend on Zustand store or other context.
 */

import type { ReactNode } from 'react';
import type { AppStore } from '../store/types';
import { createTestStore } from './testStore';

/**
 * Creates a test wrapper component with store context
 */
export const createTestWrapper = (initialState?: Partial<AppStore>) => {
  const store = createTestStore(initialState);

  return ({ children }: { children: ReactNode }) => {
    // For now, just return children directly
    // When we need Provider context, we can add it here
    return children;
  };
};

/**
 * Mock DOM environment for hook testing
 */
export const setupDOMEnvironment = () => {
  if (typeof globalThis.document === 'undefined') {
    // Create stateful mocks
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
          } else {
            classes.add(className);
            return true;
          }
        } else if (force) {
          classes.add(className);
          return true;
        } else {
          classes.delete(className);
          return false;
        }
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

    (globalThis as any).document = {
      documentElement: {
        classList: classListMock,
        style: styleMock,
      },
      createElement: () => ({ classList: classListMock, style: styleMock }),
      appendChild: () => {},
    };

    (globalThis as any).window = {
      matchMedia: () => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      }),
    };
  }
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
      properties.forEach(prop => {
        if (prop.startsWith('--')) {
          document.documentElement.style.removeProperty(prop);
        }
      });
    }
  } catch (e) {
    // Ignore cleanup errors in mock environment
  }
};
