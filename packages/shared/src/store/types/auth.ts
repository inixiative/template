import type {
  AuthOrganization,
  AuthOrganizationUser,
  AuthSession,
  AuthSpace,
  AuthSpaceUser,
  AuthUser,
} from '@template/shared/auth/types';

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
    setUser: (user: AuthUser | null) => void;
    setSession: (session: AuthSession | null) => void;
    setStrategy: (strategy: AuthStrategy) => void;
    setSpoofUserEmail: (email: string | null) => void;
    setSpoofingState: (isSpoofing: boolean, email: string | null) => void;
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
