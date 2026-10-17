/**
 * @atlas
 * @kind type
 * @partOf primitive:requestContext
 * @uses infrastructure:prisma
 */
import type {
  Organization,
  OrganizationUser,
  Space,
  SpaceUser,
  Token,
  User,
} from '@template/db/generated/client/client';
import type { Slice } from '@template/permissions';

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
};

export type SliceGrant = Slice & { inquiryId: string; integrationId: string | null };
