/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates
 */
import { z } from '@hono/zod-openapi';
import { OrganizationUserScalarInputSchema, OrganizationUserScalarSchema } from '@template/db';
import { updateRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';

export const organizationUserUpdateRoute = updateRoute({
  model: Modules.organizationUser,
  bodySchema: OrganizationUserScalarInputSchema.pick({ role: true })
    .extend({ entitlements: z.record(z.string(), z.boolean()).nullable() })
    .partial(),
  responseSchema: OrganizationUserScalarSchema,
});
