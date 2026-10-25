/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates
 */
import {
  OrganizationScalarInputSchema,
  OrganizationScalarSchema,
  OrganizationUserScalarSchema,
} from '@template/db';
import { UserAction } from '@template/permissions/client';
import { createRoute } from '#/lib/routeTemplates';
import { meResourceMiddleware } from '#/middleware/resources/meResourceMiddleware';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

const responseSchema = OrganizationScalarSchema.extend({
  organizationUser: OrganizationUserScalarSchema,
});

export const organizationCreateRoute = createRoute({
  model: Modules.organization,
  bodySchema: OrganizationScalarInputSchema.pick({ name: true, slug: true }),
  responseSchema,
  middleware: [meResourceMiddleware, validatePermission(UserAction.createOrganization)],
});
