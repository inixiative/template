/**
 * @atlas
 * @kind type, store
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import type { MeReadResponses } from '@template/sdk';
import type { TwoFactorAction, TwoFactorMethod } from '@template/shared/auth/twoFactor';
import type { ChangePasswordInput } from '@template/ui/lib/auth/changePassword';
import type { AuthMethod, SignInResult, SignUpResult } from '@template/ui/lib/auth/types';
import type { createAuthClient } from 'better-auth/client';

type BetterAuthClient = ReturnType<typeof createAuthClient>;

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

export type TwoFactorVerifyRequest = {
  methods: TwoFactorMethod[];
  resolve: () => void;
  reject: (error: unknown) => void;
};

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
    twoFactorVerifyRequest: TwoFactorVerifyRequest | null;
    twoFactorAction: TwoFactorAction | null;
    isAuthenticated: boolean;
    isEmbedded: boolean;
    isInitialized: boolean;
    initialize: () => Promise<void>;
    refreshMe: () => Promise<void>;
    signIn: (method: AuthMethod) => Promise<SignInResult>;
    applyUpgradedJwt: (
      jwt: { token: string; expiresAt: string } | null | undefined,
      clearTwoFactorAction?: boolean,
    ) => void;
    setTwoFactorAction: (action: TwoFactorAction | null) => void;
    signUp: (method: AuthMethod) => Promise<SignUpResult>;
    changePassword: (input: ChangePasswordInput) => Promise<void>;
    requestTwoFactorVerify: (methods: TwoFactorMethod[]) => Promise<void>;
    resolveTwoFactorVerify: () => void;
    cancelTwoFactorVerify: () => void;
    setStrategy: (strategy: AuthStrategy) => void;
    setSpoof: (email: string | null) => Promise<void>;
    logout: () => Promise<void>;
  };
};
