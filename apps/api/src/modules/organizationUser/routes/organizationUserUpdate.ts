/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates
 */
import { OrganizationUserScalarInputSchema } from '@template/db';
import { updateRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';
import { organizationUserReadResponseSchema } from '#/modules/organizationUser/schemas/organizationUserSchemas';

export const organizationUserUpdateRoute = updateRoute({
  model: Modules.organizationUser,
  bodySchema: OrganizationUserScalarInputSchema.pick({ role: true }).partial(),
  responseSchema: organizationUserReadResponseSchema,
});
