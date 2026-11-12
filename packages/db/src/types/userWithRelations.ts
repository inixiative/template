/**
 * @atlas
 * @kind type
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { WithTargetEntitlements } from '@template/db/entitlements/targetEntitlements';
import type {
  Organization,
  OrganizationUser,
  Space,
  SpaceUser,
  User,
} from '@template/db/generated/client/client';

export type OrganizationUserWithEntitlements = WithTargetEntitlements<OrganizationUser>;

export type SpaceUserWithEntitlements = WithTargetEntitlements<SpaceUser>;

export type UserWithRelations = User & {
  organizationUsers: OrganizationUserWithEntitlements[];
  organizations: Organization[];
  spaceUsers: SpaceUserWithEntitlements[];
  spaces: Space[];
};
