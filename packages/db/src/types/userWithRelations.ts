import { z } from 'zod';
import type { Organization, OrganizationUser, Space, SpaceUser, User } from '@template/db/generated/client/client';
import {
  OrganizationScalarSchema,
  OrganizationUserScalarSchema,
  SpaceScalarSchema,
  SpaceUserScalarSchema,
  UserScalarSchema,
} from '@template/db/generated/zod/scalarSchemas';

export type UserWithRelations = User & {
  organizationUsers: OrganizationUser[];
  organizations: Organization[];
  spaceUsers: SpaceUser[];
  spaces: Space[];
};

export const UserWithRelationsSchema = UserScalarSchema.extend({
  organizationUsers: z.array(OrganizationUserScalarSchema),
  organizations: z.array(OrganizationScalarSchema),
  spaceUsers: z.array(SpaceUserScalarSchema),
  spaces: z.array(SpaceScalarSchema),
});
