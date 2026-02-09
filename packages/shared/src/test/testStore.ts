/**
 * Test Store Setup for Frontend Component Testing
 *
 * Provides a mock store with all required slices for testing components
 * that depend on Zustand store state.
 */

import { createStore } from 'zustand';
import type { AppStore } from '../store/types';

/**
 * Creates a mock store with sensible defaults for testing
 */
export const createTestStore = (initialState?: Partial<AppStore>) => {
  return createStore<AppStore>()((set, get) => ({
    // API slice
    api: {
      queryClient: null as any,
      setQueryClient: (client: any) => set((state) => ({ api: { ...state.api, queryClient: client } })),
    },

    // Auth slice
    auth: {
      user: null,
      session: null,
      organizationUsers: null,
      organizations: null,
      spaceUsers: null,
      spaces: null,
      strategy: { type: 'login' },
      spoofUserEmail: null,
      isSpoofing: false,
      spoofingUserEmail: null,
      isAuthenticated: false,
      isEmbedded: false,
      isInitialized: false,
      isSuperadmin: false,
      initialize: async () => null,
      setUser: () => {},
      setSession: () => {},
      setStrategy: () => {},
      setSpoofUserEmail: () => {},
      setSpoofingState: () => {},
      getOrganizationOptions: () => [],
      getUserMenu: () => ({ name: 'Test User', email: 'test@example.com' }),
      hydrate: () => {},
      requireAuth: () => {},
      logout: async () => {},
    },

    // Tenant slice
    tenant: {
      context: { type: 'public' },
      page: {},
      getCurrentContext: () => ({ type: 'public', label: 'Public' }),
      getNavContext: () => ({}),
      setPublic: () => {},
      setPersonal: () => {},
      selectOrganization: () => false,
      selectSpace: () => false,
      setOrganization: () => {},
      setSpace: () => {},
      setPage: () => {},
    },

    // Permissions slice
    permissions: {
      setup: async () => {},
      setSuperadmin: () => {},
      isSuperadmin: () => false,
      setUserId: () => {},
      userId: null,
      check: () => false,
      clear: () => {},
    } as any,

    // Navigation slice
    navigation: {
      sidebarCollapsed: false,
      setSidebarCollapsed: () => {},
      toggleSidebar: () => {},
    },

    // UI slice
    ui: {
      theme: 'light',
      setTheme: () => {},
    },

    // Apply initial state overrides
    ...initialState,
  }));
};

/**
 * Default test store instance
 */
export const testStore = createTestStore();
