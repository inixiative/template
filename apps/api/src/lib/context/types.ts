/**
 * @atlas
 * @kind type
 * @partOf primitive:requestContext
 * @uses infrastructure:prisma
 */
import type { WithEntitlementEntries } from '@template/db';
import type {
  Integration,
  Organization,
  OrganizationUser,
  Space,
  SpaceUser,
  Token,
  User,
} from '@template/db/generated/client/client';

export type TokenWithRelations = WithEntitlementEntries<Token> & {
  user: User | null;
  organization: Organization | null;
  organizationUser:
    | (WithEntitlementEntries<OrganizationUser> & { organization: Organization; user: User })
    | null;
  space: Space | null;
  spaceUser:
    | (WithEntitlementEntries<SpaceUser> & {
        organization: Organization;
        organizationUser: OrganizationUser;
        space: Space;
        user: User;
      })
    | null;
  integration: WithEntitlementEntries<Integration> | null;
};
