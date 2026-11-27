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
    'Serves every setting as one tree per resource model: each leaf with its value type, default, options and conditions, and the read and manage permission it inherits from the nearest branch above it, in declaration order. Public endpoint.',
});
