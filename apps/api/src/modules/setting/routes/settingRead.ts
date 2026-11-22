/**
 * @atlas
 * @kind route
 * @partOf feature:setting
 * @uses primitive:routeTemplates, primitive:authz
 */
import { SettingScalarSchema } from '@template/db';
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

export const settingReadRoute = readRoute({
  model: Modules.setting,
  middleware: [validatePermission('read')],
  responseSchema: SettingScalarSchema,
});
