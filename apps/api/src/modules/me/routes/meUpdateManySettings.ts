/**
 * @atlas
 * @kind route
 * @partOf feature:users, feature:setting
 * @uses primitive:routeTemplates
 */
import { SettingScalarSchema } from '@template/db';
import { updateRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';
import { OpenApiTags } from '#/modules/openApiTags';
import { settingUpsertItemSchema } from '#/modules/setting/schemas/settingSchemas';

export const meUpdateManySettingsRoute = updateRoute({
  model: Modules.me,
  submodel: Modules.setting,
  many: true,
  skipId: true,
  bodySchema: settingUpsertItemSchema,
  responseSchema: SettingScalarSchema,
  tags: [OpenApiTags.me, OpenApiTags.setting],
  description: 'Atomically creates or updates a batch of personal settings for the acting user.',
});
