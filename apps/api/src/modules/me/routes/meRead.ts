import { z } from '@hono/zod-openapi';
import {
  OrganizationScalarSchema,
  OrganizationUserScalarSchema,
  SpaceScalarSchema,
  SpaceUserScalarSchema,
  UserScalarSchema,
} from '@template/db';
import { readRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

const responseSchema = UserScalarSchema.extend({
  organizationUsers: z.array(OrganizationUserScalarSchema),
  spaceUsers: z.array(SpaceUserScalarSchema),
  organizations: z.array(OrganizationScalarSchema),
  spaces: z.array(SpaceScalarSchema),
});

export const meReadRoute = readRoute({
  model: Modules.me,
  skipId: true,
  responseSchema,
  tags: [Tags.me, Tags.user],
});
