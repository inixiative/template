/**
 * @atlas
 * @kind route
 * @partOf feature:setting
 * @uses primitive:routeTemplates, primitive:authz
 */
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';
import { settingReadResponseSchema } from '#/modules/setting/schemas/settingSchemas';

export const settingReadRoute = readRoute({
  model: Modules.setting,
  middleware: [validatePermission('read')],
  responseSchema: settingReadResponseSchema,
});
