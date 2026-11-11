/**
 * @atlas
 * @kind type
 * @partOf primitive:requestContext
 * @uses infrastructure:prisma
 */
import type { WithTargetEntitlements } from '@template/db';
import type {
  Integration,
  Organization,
  OrganizationUser,
  Space,
  SpaceUser,
  Token,
  User,
} from '@template/db/generated/client/client';

export type TokenWithRelations = WithTargetEntitlements<Token> & {
  user: User | null;
  organization: Organization | null;
  organizationUser:
    | (WithTargetEntitlements<OrganizationUser> & { organization: Organization; user: User })
    | null;
  space: Space | null;
  spaceUser:
    | (WithTargetEntitlements<SpaceUser> & {
        organization: Organization;
        organizationUser: OrganizationUser;
        space: Space;
        user: User;
      })
    | null;
  integration: WithTargetEntitlements<Integration> | null;
};
