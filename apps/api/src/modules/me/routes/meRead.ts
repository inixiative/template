/**
 * @atlas
 * @kind route
 * @partOf feature:users
 * @uses primitive:routeTemplates, feature:tenancy
 */
import { z } from '@hono/zod-openapi';
import { OrganizationScalarSchema, SpaceScalarSchema } from '@template/db';
import { TWO_FACTOR_ACTIONS } from '@template/shared/auth/twoFactor';
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';
import { OpenApiTags } from '#/modules/openApiTags';
import { organizationUserReadResponseSchema } from '#/modules/organizationUser/schemas/organizationUserSchemas';
import { spaceUserReadResponseSchema } from '#/modules/spaceUser/schemas/spaceUserSchemas';
import { userResponseSchema } from '#/modules/user/schemas/userResponseSchema';

const responseSchema = userResponseSchema.extend({
  organizationUsers: z.array(organizationUserReadResponseSchema),
  spaceUsers: z.array(spaceUserReadResponseSchema),
  organizations: z.array(OrganizationScalarSchema),
  spaces: z.array(SpaceScalarSchema),
  twoFactorAction: z.enum(TWO_FACTOR_ACTIONS).nullable(),
});

export const meReadRoute = readRoute({
  model: Modules.me,
  middleware: [validatePermission('read')],
  skipId: true,
  responseSchema,
  tags: [OpenApiTags.me, OpenApiTags.user],
});
