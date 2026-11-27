/**
 * @atlas
 * @kind type, store
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import type { MeReadResponses } from '@template/sdk';
import type { TwoFactorAction } from '@template/shared/auth/twoFactor';
import type { ResetPasswordInput, ResetPasswordResult } from '@template/ui/lib/auth/resetPassword';
import type { AuthMethod, SignInResult, SignUpResult } from '@template/ui/lib/auth/types';
import type { createAuthClient } from 'better-auth/client';
import type { oneTimeTokenClient } from 'better-auth/client/plugins';

export type BetterAuthClient = ReturnType<
  typeof createAuthClient<{ plugins: [ReturnType<typeof oneTimeTokenClient>] }>
>;

type MeData = MeReadResponses[200]['data'];
type User = Omit<
  MeData,
  'organizations' | 'spaces' | 'organizationUsers' | 'spaceUsers' | 'twoFactorAction'
>;
type Organization = MeData['organizations'][number];
type Space = MeData['spaces'][number];
type OrganizationUser = MeData['organizationUsers'][number];
type SpaceUser = MeData['spaceUsers'][number];

export type AuthStrategy = { type: 'login' } | { type: 'embed'; parentOrigin?: string };

export type AuthSlice = {
  auth: {
    client: BetterAuthClient;
    user: User | null;
    organizations: Record<string, Organization> | null;
    organizationUsers: Record<string, OrganizationUser> | null;
    spaces: Record<string, Space> | null;
    spaceUsers: Record<string, SpaceUser> | null;
    strategy: AuthStrategy;
    spoofUserEmail: string | null;
    spoofingUserEmail: string | null;
    twoFactorAction: TwoFactorAction | null;
    isAuthenticated: boolean;
    isEmbedded: boolean;
    isInitialized: boolean;
    initialize: () => Promise<void>;
    refreshMe: () => Promise<void>;
    signIn: (method: AuthMethod) => Promise<SignInResult>;
    completeOAuthSignIn: (oneTimeToken: string) => Promise<void>;
    requestPasswordReset: (email: string) => Promise<void>;
    resetPassword: (input: ResetPasswordInput) => Promise<ResetPasswordResult>;
    applyUpgradedJwt: (
      jwt: { token: string; expiresAt: string } | null | undefined,
      clearTwoFactorAction?: boolean,
    ) => void;
    setTwoFactorAction: (action: TwoFactorAction | null) => void;
    signUp: (method: AuthMethod) => Promise<SignUpResult>;
    setStrategy: (strategy: AuthStrategy) => void;
    setSpoof: (email: string | null) => Promise<void>;
    logout: () => Promise<void>;
  };
};
