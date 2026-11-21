/**
 * @atlas
 * @kind route
 * @partOf feature:setting
 * @uses primitive:routeTemplates
 */
import { readRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';
import { settingInfoResponseSchema } from '#/modules/setting/schemas/settingInfoResponseSchema';

export const settingInfoRoute = readRoute({
  model: Modules.setting,
  action: 'info',
  skipId: true,
  responseSchema: settingInfoResponseSchema,
  description:
    'Lists every setting category and registered setting definition: applicable resource models, attribute value type, JSON Schema of `value`, default value, display order, and required ReBAC permission. Public endpoint.',
});
