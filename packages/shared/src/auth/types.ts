/**
 * Auth types for frontend state management.
 * These mirror the API response structures.
 */

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  displayName: string | null;
  emailVerified: boolean;
  platformRole: 'superadmin' | 'user';
  createdAt: string;
  updatedAt: string;
};

export type AuthSession = {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
  ipAddress: string | null;
  userAgent: string | null;
};

export type AuthOrganization = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
};

export type AuthOrganizationUser = {
  id: string;
  userId: string;
  organizationId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  organization?: AuthOrganization;
};

export type AuthSpace = {
  id: string;
  name: string;
  slug: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
};

export type AuthSpaceUser = {
  id: string;
  userId: string;
  organizationId: string;
  spaceId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  space?: AuthSpace;
};

export type AuthClient = {
  signIn: (credentials: { email: string; password: string }) => Promise<{ user: AuthUser; session: AuthSession }>;
  signUp: (credentials: { email: string; password: string; name?: string }) => Promise<{ user: AuthUser; session: AuthSession }>;
  signOut: () => Promise<void>;
};

export type ApiClient = {
  request: (config: unknown) => Promise<unknown>;
};
