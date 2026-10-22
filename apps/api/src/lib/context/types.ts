/**
 * @atlas
 * @kind type
 * @partOf primitive:requestContext
 * @uses infrastructure:prisma
 */
import type {
  Integration,
  Organization,
  OrganizationUser,
  Space,
  SpaceUser,
  Token,
  User,
} from '@template/db/generated/client/client';
import type { Role } from '@template/db/generated/client/enums';
import type { Entitlements } from '@template/permissions';

export type IntegrationWithOwners = Integration & {
  organizationUser: OrganizationUser | null;
  spaceUser: SpaceUser | null;
};

export type TokenWithRelations = Token & {
  user: User | null;
  organization: Organization | null;
  organizationUser: (OrganizationUser & { organization: Organization; user: User }) | null;
  space: Space | null;
  spaceUser:
    | (SpaceUser & {
        organization: Organization;
        organizationUser: OrganizationUser;
        space: Space;
        user: User;
      })
    | null;
  integration: IntegrationWithOwners | null;
};

export type CredentialGrant = {
  role: Role | null;
  entitlements: Entitlements;
  integrationId: string | null;
};

export type GrantedEntitlements = CredentialGrant & { inquiryId: string };
