import { meRead } from '@template/shared/apiClient';
import type {
  AuthOrganization,
  AuthOrganizationUser,
  AuthSession,
  AuthSpace,
  AuthSpaceUser,
  AuthUser,
} from '@template/shared/auth/types';
import type { UserWithRelations } from '@template/db';
import { createAuthClient as createBetterAuthClient } from 'better-auth/client';
import type { StateCreator } from 'zustand';
import type { AppStore } from '../types';

export type AuthStrategy = { type: 'login' } | { type: 'embed'; parentOrigin?: string };

export type AuthOrganizationOption = {
  id: string;
  name: string;
  spaces: Array<{ id: string; name: string }>;
};

export type AuthUserMenu = {
  name: string;
  email: string;
  avatarUrl?: string;
};

type AuthInitializeDependencies = {
  api: {
    queryClient: {
      fetchQuery: <T>(options: unknown) => Promise<{ data?: T }>;
    };
  };
  permissions: {
    setup: (me: UserWithRelations) => Promise<void>;
  };
};

export type AuthSlice = {
  auth: {
    user: AuthUser | null;
    session: AuthSession | null;
    organizationUsers: AuthOrganizationUser[] | null;
    organizations: AuthOrganization[] | null;
    spaceUsers: AuthSpaceUser[] | null;
    spaces: AuthSpace[] | null;
    strategy: AuthStrategy;
    spoofUserEmail: string | null;
    isSpoofing: boolean;
    spoofingUserEmail: string | null;
    isAuthenticated: boolean;
    isEmbedded: boolean;
    isInitialized: boolean;
    isSuperadmin: boolean;
    initialize: () => Promise<AuthUser | null>;
    signIn: (credentials: { email: string; password: string }) => Promise<void>;
    signUp: (credentials: { email: string; password: string; name?: string }) => Promise<void>;
    setUser: (user: AuthUser | null) => void;
    setSession: (session: AuthSession | null) => void;
    setStrategy: (strategy: AuthStrategy) => void;
    setSpoofUserEmail: (email: string | null) => void;
    setSpoofingState: (isSpoofing: boolean, spoofingUserEmail: string | null) => void;
    getOrganizationOptions: () => AuthOrganizationOption[];
    getUserMenu: (fallbackName?: string) => AuthUserMenu;
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

export const createAuthSlice: StateCreator<AppStore, [], [], AuthSlice> = (set, get) => ({
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
    isSuperadmin: false, // Set during hydrate based on permissions

    initialize: async () => {
      const state = get() as AuthSlice & AuthInitializeDependencies;
      if (state.auth.isInitialized) return state.auth.user;

      try {
        // Use fetch directly to capture response headers for spoof detection
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const token = state.auth.session?.accessToken;
        const spoofEmail = state.auth.spoofUserEmail;

        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;
        if (spoofEmail) headers['x-spoof-user-email'] = spoofEmail;

        const { data, response } = await meRead();

        // Detect spoofing from response headers
        const spoofingEmail = response.headers.get('x-spoofing-user-email');
        const spoofedEmail = response.headers.get('x-spoofed-user-email');
        if (spoofingEmail && spoofedEmail) state.auth.setSpoofingState(true, spoofingEmail);
        else state.auth.setSpoofingState(false, null);

        // API wraps response in { data: {...} }, SDK wraps that in { data: {...}, response }
        const userData = data.data;
        const { organizationUsers, organizations, spaceUsers, spaces, ...user } = userData;

        state.auth.hydrate({
          user: user as AuthUser,
          session: null,
          organizationUsers: organizationUsers as AuthOrganizationUser[] | undefined,
          organizations,
          spaceUsers: spaceUsers as AuthSpaceUser[] | undefined,
          spaces,
        });

        await state.permissions.setup(userData as UserWithRelations);

        return user as AuthUser;
      } catch (error) {
        set((current) => ({
          auth: {
            ...current.auth,
            user: null,
            session: null,
            organizationUsers: null,
            organizations: null,
            spaceUsers: null,
            spaces: null,
            isAuthenticated: false,
            isInitialized: true,
          },
        }));
        throw error;
      }
    },

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

    setSpoofUserEmail: (email) =>
      set((state) => ({
        auth: { ...state.auth, spoofUserEmail: email },
      })),

    setSpoofingState: (isSpoofing, spoofingUserEmail) =>
      set((state) => ({
        auth: { ...state.auth, isSpoofing, spoofingUserEmail },
      })),

    getOrganizationOptions: () => {
      const auth = get().auth;
      const spacesByOrg = new Map<string, Array<{ id: string; name: string }>>();
      for (const space of auth.spaces || []) {
        const list = spacesByOrg.get(space.organizationId) || [];
        list.push({ id: space.id, name: space.name });
        spacesByOrg.set(space.organizationId, list);
      }

      return (auth.organizations || []).map((organization) => ({
        id: organization.id,
        name: organization.name,
        spaces: spacesByOrg.get(organization.id) || [],
      }));
    },

    getUserMenu: (fallbackName = 'User') => {
      const auth = get().auth;
      return {
        name: auth.user?.name || fallbackName,
        email: auth.user?.email || '',
        avatarUrl: undefined,
      };
    },

    hydrate: (data) => {
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
      }));

      // Set context to personal when user logs in, public when logged out
      const tenant = get().tenant;
      if (data.user) {
        tenant.setPersonal();
      } else {
        tenant.setPublic();
      }
    },

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
          window.parent.postMessage({ type: 'embed:auth_required' }, auth.strategy.parentOrigin ?? '*');
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
          spoofUserEmail: null,
          isSpoofing: false,
          spoofingUserEmail: null,
          isAuthenticated: false,
        },
      }));

      // Set context to public when logging out
      get().tenant.setPublic();
    },
  },
});
