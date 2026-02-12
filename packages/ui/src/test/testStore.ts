/**
 * Test Store Setup for Frontend Component Testing
 *
 * Provides a test store with slice implementations suitable for testing.
 * Avoids circular dependencies by using inline implementations.
 */

import { QueryClient } from '@tanstack/react-query';
import { createStore, type StateCreator } from 'zustand';
import type { AppStore } from '@template/ui/store/types';
import type { PermissionsSlice } from '@template/ui/store/types/permissions';
import { createTenantSlice } from '@template/ui/store/slices/tenant';
import { createNavigationSlice } from '@template/ui/store/slices/navigation';
import { createUISlice } from '@template/ui/store/slices/ui';
import { createAuthSlice } from '@template/ui/store/slices/auth';

/**
 * Test-friendly permissions slice that doesn't import runtime dependencies
 */
const createTestPermissionsSlice: StateCreator<AppStore, [], [], PermissionsSlice> = (set, get) => {
  let mockPermix = {
    setUserId: () => {},
    setSuperadmin: () => {},
    setup: async () => {},
  };

  return {
    permissions: {
      permix: mockPermix as any,
      check: () => false,
      clear: () => {
        mockPermix = {
          setUserId: () => {},
          setSuperadmin: () => {},
          setup: async () => {},
        };
        set((state) => ({
          permissions: {
            ...state.permissions,
            permix: mockPermix as any,
          },
        }));
      },
      setup: async () => {},
    },
  };
};


/**
 * Creates a test store with test-friendly slice implementations
 */
export const createTestStore = (initialState?: Partial<AppStore>) => {
  const store = createStore<AppStore>()((set, get) => ({
    // Client slice
    client: new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    }),

    // Auth slice (real implementation)
    ...createAuthSlice(set, get, {} as any),

    // Tenant slice (real implementation)
    ...createTenantSlice(set, get, {} as any),

    // Permissions slice (test version)
    ...createTestPermissionsSlice(set, get, {} as any),

    // Navigation slice (real implementation)
    ...createNavigationSlice(set, get, {} as any),

    // UI slice (real implementation)
    ...createUISlice(set, get, {} as any),

    // Apply initial state overrides
    ...initialState,
  }));

  return store;
};

/**
 * Default test store instance
 */
export const testStore = createTestStore();
