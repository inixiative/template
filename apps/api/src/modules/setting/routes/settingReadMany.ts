/**
 * @atlas
 * @kind route
 * @partOf feature:setting
 * @uses primitive:routeTemplates, primitive:authz
 */
import { readRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';
import {
  settingEffectiveItemSchema,
  settingReadManyQuerySchema,
  settingTargetRefinement,
} from '#/modules/setting/schemas/settingSchemas';

export const settingReadManyRoute = readRoute({
  model: Modules.setting,
  many: true,
  skipId: true,
  query: settingReadManyQuerySchema,
  queryRefinement: settingTargetRefinement,
  responseSchema: settingEffectiveItemSchema,
  description:
    'Lists effective settings for a target resource, merging stored rows with code-defined defaults. Filterable by `category` and `key`.',
});
