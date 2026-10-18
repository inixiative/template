/**
 * @atlas
 * @kind route
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:tenancy
 */
import { z } from '@hono/zod-openapi';
import {
  OrganizationScalarSchema,
  OrganizationUserScalarSchema,
  SpaceScalarSchema,
  SpaceUserScalarSchema,
} from '@template/db';
import { UserAction } from '@template/permissions/client';
import { readRoute } from '#/lib/routeTemplates';
import { validateSelfPermission } from '#/middleware/validations/validateSelfPermission';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';
import { userResponseSchema } from '#/modules/user/schemas/userResponseSchema';

const responseSchema = userResponseSchema.extend({
  organizationUsers: z.array(OrganizationUserScalarSchema),
  spaceUsers: z.array(SpaceUserScalarSchema),
  organizations: z.array(OrganizationScalarSchema),
  spaces: z.array(SpaceScalarSchema),
});

export const meReadRoute = readRoute({
  model: Modules.me,
  middleware: [validateSelfPermission(UserAction.identify)],
  skipId: true,
  responseSchema,
  tags: [Tags.me, Tags.user],
});
