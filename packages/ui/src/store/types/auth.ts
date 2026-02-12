import type { MeReadResponses } from '@template/ui/apiClient';
import { createAuthClient } from 'better-auth/client';

type BetterAuthClient = ReturnType<typeof createAuthClient>;

type MeData = MeReadResponses[200]['data'];
type User = Omit<MeData, 'organizations' | 'spaces' | 'organizationUsers' | 'spaceUsers'>;
type Organization = MeData['organizations'][number];
type Space = MeData['spaces'][number];

export type AuthStrategy = { type: 'login' } | { type: 'embed'; parentOrigin?: string };

export type SignInCredentials = Record<string, any>;
export type SignUpCredentials = Record<string, any>;

export type AuthSlice = {
  auth: {
    client: BetterAuthClient;
    user: User | null;
    organizations: Record<string, Organization> | null;
    spaces: Record<string, Space> | null;
    strategy: AuthStrategy;
    spoofUserEmail: string | null;
    spoofingUserEmail: string | null;
    isAuthenticated: boolean;
    isEmbedded: boolean;
    isInitialized: boolean;
    initialize: () => Promise<void>;
    signIn: (credentials: SignInCredentials) => Promise<void>;
    signUp: (credentials: SignUpCredentials) => Promise<void>;
    setStrategy: (strategy: AuthStrategy) => void;
    setSpoof: (email: string | null) => Promise<void>;
    logout: () => Promise<void>;
  };
};
