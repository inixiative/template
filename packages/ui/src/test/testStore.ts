/**
 * Test Store Setup for Frontend Component Testing
 *
 * Provides a test store with slice implementations suitable for testing.
 * Avoids circular dependencies by using inline implementations.
 */

import { QueryClient } from '@tanstack/react-query';
import type { Permix } from '@template/permissions/client';
import { createAuthSlice } from '@template/ui/store/slices/auth';
import { createNavigationSlice } from '@template/ui/store/slices/navigation';
import { createTenantSlice } from '@template/ui/store/slices/tenant';
import { createUISlice } from '@template/ui/store/slices/ui';
import type { AppStore } from '@template/ui/store/types';
import type { PermissionsSlice } from '@template/ui/store/types/permissions';
import { createStore, type StateCreator, type StoreApi } from 'zustand';

/**
 * Test-friendly permissions slice that doesn't import runtime dependencies
 */
const createTestPermissionsSlice: StateCreator<AppStore, [], [], PermissionsSlice> = (set, _get) => {
  const makeMockPermix = (): Permix => ({
    check: () => false,
    setup: async () => {},
    setSuperadmin: () => {},
    isSuperadmin: () => false,
    setUserId: () => {},
    getUserId: () => null,
    getJSON: () => null,
  });

  let mockPermix = makeMockPermix();

  return {
    permissions: {
      permix: mockPermix,
      check: () => false,
      clear: () => {
        mockPermix = makeMockPermix();
        set((state) => ({
          permissions: {
            ...state.permissions,
            permix: mockPermix,
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
    ...createAuthSlice(set, get, {} as StoreApi<AppStore>),

    // Tenant slice (real implementation)
    ...createTenantSlice(set, get, {} as StoreApi<AppStore>),

    // Permissions slice (test version)
    ...createTestPermissionsSlice(set, get, {} as StoreApi<AppStore>),

    // Navigation slice (real implementation)
    ...createNavigationSlice(set, get, {} as StoreApi<AppStore>),

    // UI slice (real implementation)
    ...createUISlice(set, get, {} as StoreApi<AppStore>),

    // Apply initial state overrides
    ...initialState,
  }));

  return store;
};

/**
 * Default test store instance
 */
export const testStore = createTestStore();
