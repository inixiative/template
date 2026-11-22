/**
 * @atlas
 * @kind route
 * @partOf feature:project, feature:setting
 * @uses primitive:routeTemplates
 */
import { SettingScalarSchema } from '@template/db';
import { updateRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';
import {
  makeSettingUpsertItemRefinement,
  settingUpsertItemSchema,
} from '#/modules/setting/schemas/settingSchemas';

export const projectUpdateManySettingsRoute = updateRoute({
  model: Modules.project,
  submodel: Modules.setting,
  many: true,
  bodySchema: settingUpsertItemSchema,
  bodyRefinement: makeSettingUpsertItemRefinement('Project'),
  responseSchema: SettingScalarSchema,
  description: 'Atomically creates or updates a batch of settings for this project.',
});
