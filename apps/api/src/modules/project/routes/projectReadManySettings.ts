/**
 * @atlas
 * @kind route
 * @partOf feature:project, feature:setting
 * @uses primitive:routeTemplates, primitive:authz
 */
import { SettingScalarSchema } from '@template/db';
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';
import { settingListQuerySchema } from '#/modules/setting/schemas/settingSchemas';

export const projectReadManySettingsRoute = readRoute({
  model: Modules.project,
  submodel: Modules.setting,
  many: true,
  query: settingListQuerySchema,
  middleware: [validatePermission('read')],
  responseSchema: SettingScalarSchema,
});
