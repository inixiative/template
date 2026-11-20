/**
 * @atlas
 * @kind route
 * @partOf feature:users
 * @uses primitive:routeTemplates, primitive:authz
 */
import { z } from '@hono/zod-openapi';
import { tenantPermissionRulesSchema } from '@template/permissions/rebac/permissionRulesSchema';
import { actionRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';
import { OpenApiTags } from '#/modules/openApiTags';
import { userResponseSchema } from '#/modules/user/schemas/userResponseSchema';

export const meSetTenantPermissionRulesRoute = actionRoute({
  model: Modules.me,
  action: 'setTenantPermissionRules',
  skipId: true,
  bodySchema: z.object({ tenantPermissionRules: tenantPermissionRulesSchema }),
  responseSchema: userResponseSchema,
  middleware: [validatePermission('own')],
  description:
    "Replaces your own permission rules for the records under you. Each rule is ORed with the schema's for that resource and action, so it can only widen. Null clears them.",
  tags: [OpenApiTags.me, OpenApiTags.user],
});
