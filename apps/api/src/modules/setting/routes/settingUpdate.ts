/**
 * @atlas
 * @kind route
 * @partOf feature:setting
 * @uses primitive:routeTemplates, primitive:authz
 */
import { updateRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';
import {
  settingReadResponseSchema,
  settingUpsertBodyRefinement,
  settingUpsertBodySchema,
} from '#/modules/setting/schemas/settingSchemas';

export const settingUpdateRoute = updateRoute({
  model: Modules.setting,
  skipId: true,
  bodySchema: settingUpsertBodySchema,
  bodyRefinement: settingUpsertBodyRefinement,
  responseSchema: settingReadResponseSchema,
  description:
    'Atomically sets (creates or updates) one setting for a target resource. Validated against the code-first setting registry and recorded in AuditLog.',
});
