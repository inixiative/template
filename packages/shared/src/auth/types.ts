/**
 * @atlas
 * @kind type
 * @partOf primitive:shared
 * @uses none
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

export type ApiClient = {
  request: (config: unknown) => Promise<unknown>;
};
