import type { StateCreator } from 'zustand';
import type {
  AuthUser,
  AuthSession,
  AuthOrganizationUser,
  AuthOrganization,
  AuthSpaceUser,
  AuthSpace,
} from '../../auth/types';

export type AuthStrategy = { type: 'login' } | { type: 'embed'; parentOrigin?: string };

export type AuthSlice = {
  auth: {
    user: AuthUser | null;
    session: AuthSession | null;
    organizationUsers: AuthOrganizationUser[] | null;
    organizations: AuthOrganization[] | null;
    spaceUsers: AuthSpaceUser[] | null;
    spaces: AuthSpace[] | null;
    strategy: AuthStrategy;
    isAuthenticated: boolean;
    isEmbedded: boolean;
    isInitialized: boolean;
    setUser: (user: AuthUser | null) => void;
    setSession: (session: AuthSession | null) => void;
    setStrategy: (strategy: AuthStrategy) => void;
    hydrate: (data: {
      user: AuthUser | null;
      session: AuthSession | null;
      organizationUsers?: AuthOrganizationUser[];
      organizations?: AuthOrganization[];
      spaceUsers?: AuthSpaceUser[];
      spaces?: AuthSpace[];
    }) => void;
    requireAuth: (onSuccess?: () => void) => void;
    logout: () => Promise<void>;
  };
};

export const createAuthSlice: StateCreator<AuthSlice> = (set, get) => ({
  auth: {
    user: null,
    session: null,
    organizationUsers: null,
    organizations: null,
    spaceUsers: null,
    spaces: null,
    strategy: { type: 'login' },
    isAuthenticated: false,
    isEmbedded: false,
    isInitialized: false,

    setUser: (user) =>
      set((state) => ({
        auth: {
          ...state.auth,
          user,
          isAuthenticated: !!user,
        },
      })),

    setSession: (session) =>
      set((state) => ({
        auth: { ...state.auth, session },
      })),

    setStrategy: (strategy) =>
      set((state) => ({
        auth: {
          ...state.auth,
          strategy,
          isEmbedded: strategy.type === 'embed',
        },
      })),

    hydrate: (data) =>
      set((state) => ({
        auth: {
          ...state.auth,
          user: data.user,
          session: data.session,
          organizationUsers: data.organizationUsers || null,
          organizations: data.organizations || null,
          spaceUsers: data.spaceUsers || null,
          spaces: data.spaces || null,
          isAuthenticated: !!data.user,
          isInitialized: true,
        },
      })),

    requireAuth: (onSuccess) => {
      const { auth } = get();
      if (auth.isAuthenticated) {
        onSuccess?.();
        return;
      }

      switch (auth.strategy.type) {
        case 'login':
          // TODO: Show login modal or redirect to /login
          break;
        case 'embed':
          window.parent.postMessage(
            { type: 'embed:auth_required' },
            auth.strategy.parentOrigin ?? '*',
          );
          break;
      }
    },

    logout: async () => {
      // Clear state immediately for responsive UI
      set((state) => ({
        auth: {
          ...state.auth,
          user: null,
          session: null,
          organizationUsers: null,
          organizations: null,
          spaceUsers: null,
          spaces: null,
          isAuthenticated: false,
        },
      }));
    },
  },
});
