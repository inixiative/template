/**
 * Test Utilities for Component Testing
 *
 * Provides wrappers and utilities for testing React components
 * that depend on Zustand store or other context.
 *
 * DOM environment is provided globally by happy-dom via the
 * preload in bunfig.toml — no manual setup/teardown needed.
 * See src/test/setup.ts for details.
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
