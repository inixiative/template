/**
 * @atlas
 * @kind route
 * @partOf feature:project, feature:setting
 * @uses primitive:routeTemplates
 */
import { SettingScalarSchema } from '@template/db';
import { updateRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';
import { settingUpsertItemSchema } from '#/modules/setting/schemas/settingSchemas';

export const projectIntegrationUpdateManySettingsRoute = updateRoute({
  model: Modules.projectIntegration,
  submodel: Modules.setting,
  many: true,
  bodySchema: settingUpsertItemSchema,
  responseSchema: SettingScalarSchema,
  description: 'Atomically creates or updates a batch of settings for this project integration.',
});
