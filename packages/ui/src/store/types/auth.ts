import type { MeReadResponses } from '@template/ui/apiClient';
import type { AuthMethod } from '@template/ui/lib/auth/types';
import type { createAuthClient } from 'better-auth/client';

type BetterAuthClient = ReturnType<typeof createAuthClient>;

type MeData = MeReadResponses[200]['data'];
type User = Omit<MeData, 'organizations' | 'spaces' | 'organizationUsers' | 'spaceUsers'>;
type Organization = MeData['organizations'][number];
type Space = MeData['spaces'][number];
type SpaceUser = MeData['spaceUsers'][number];

export type AuthStrategy = { type: 'login' } | { type: 'embed'; parentOrigin?: string };

export type SignInCredentials = Record<string, unknown>;
export type SignUpCredentials = Record<string, unknown>;

export type AuthSlice = {
  auth: {
    client: BetterAuthClient;
    user: User | null;
    organizations: Record<string, Organization> | null;
    spaces: Record<string, Space> | null;
    spaceUsers: Record<string, SpaceUser> | null;
    strategy: AuthStrategy;
    spoofUserEmail: string | null;
    spoofingUserEmail: string | null;
    isAuthenticated: boolean;
    isEmbedded: boolean;
    isInitialized: boolean;
    initialize: () => Promise<void>;
    refreshMe: () => Promise<void>;
    signIn: (method: AuthMethod) => Promise<void>;
    signUp: (method: AuthMethod) => Promise<void>;
    setStrategy: (strategy: AuthStrategy) => void;
    setSpoof: (email: string | null) => Promise<void>;
    logout: () => Promise<void>;
  };
};
