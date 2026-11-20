/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, primitive:authz
 */
import { z } from '@hono/zod-openapi';
import { OrganizationScalarSchema } from '@template/db';
import { tenantPermissionRulesSchema } from '@template/permissions/rebac/permissionRulesSchema';
import { actionRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const organizationSetTenantPermissionRulesRoute = actionRoute({
  model: Modules.organization,
  action: 'setTenantPermissionRules',
  bodySchema: z.object({ tenantPermissionRules: tenantPermissionRulesSchema }),
  responseSchema: OrganizationScalarSchema,
  middleware: [validatePermission('own')],
  description:
    "Replaces the organization's own permission rules for the records under it. Each rule is ORed with the schema's for that resource and action, so it can only widen. Null clears them.",
});
