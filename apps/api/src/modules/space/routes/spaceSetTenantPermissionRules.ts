/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, primitive:authz
 */
import { z } from '@hono/zod-openapi';
import { SpaceScalarSchema } from '@template/db';
import { tenantPermissionRulesSchema } from '@template/permissions/rebac/permissionRulesSchema';
import { actionRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const spaceSetTenantPermissionRulesRoute = actionRoute({
  model: Modules.space,
  action: 'setTenantPermissionRules',
  bodySchema: z.object({ tenantPermissionRules: tenantPermissionRulesSchema }),
  responseSchema: SpaceScalarSchema,
  middleware: [validatePermission('own')],
  description:
    "Replaces the space's own permission rules for the records under it. Each rule is ORed with the schema's for that resource and action, so it can only widen. Null clears them.",
});
