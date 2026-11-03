/**
 * @atlas
 * @kind type
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { WithEntitlementEntries } from '@template/db/entitlements/targetEntitlements';
import type {
  Organization,
  OrganizationUser,
  Space,
  SpaceUser,
  User,
} from '@template/db/generated/client/client';

export type OrganizationUserWithEntitlements = WithEntitlementEntries<OrganizationUser>;

export type SpaceUserWithEntitlements = WithEntitlementEntries<SpaceUser>;

export type UserWithRelations = User & {
  organizationUsers: OrganizationUserWithEntitlements[];
  organizations: Organization[];
  spaceUsers: SpaceUserWithEntitlements[];
  spaces: Space[];
};
