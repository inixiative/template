/**
 * @atlas
 * @kind route
 * @partOf feature:users, feature:setting
 * @uses primitive:routeTemplates, primitive:authz
 */
import { SettingScalarSchema } from '@template/db';
import { readRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';
import { OpenApiTags } from '#/modules/openApiTags';
import { settingListQuerySchema } from '#/modules/setting/schemas/settingSchemas';

export const meReadManySettingsRoute = readRoute({
  model: Modules.me,
  submodel: Modules.setting,
  many: true,
  skipId: true,
  query: settingListQuerySchema,
  middleware: [validatePermission('read')],
  responseSchema: SettingScalarSchema,
  tags: [OpenApiTags.me, OpenApiTags.setting],
});
