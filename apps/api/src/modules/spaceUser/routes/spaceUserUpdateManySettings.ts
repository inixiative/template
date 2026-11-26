/**
 * @atlas
 * @kind route
 * @partOf feature:tenancy, feature:setting
 * @uses primitive:routeTemplates
 */
import { SettingScalarSchema } from '@template/db';
import { updateRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';
import {
  settingUpsertItemRefinement,
  settingUpsertItemSchema,
} from '#/modules/setting/schemas/settingSchemas';

export const spaceUserUpdateManySettingsRoute = updateRoute({
  model: Modules.spaceUser,
  submodel: Modules.setting,
  many: true,
  bodySchema: settingUpsertItemSchema,
  bodyRefinement: settingUpsertItemRefinement,
  responseSchema: SettingScalarSchema,
  description: 'Atomically creates or updates a batch of settings for this space membership.',
});
