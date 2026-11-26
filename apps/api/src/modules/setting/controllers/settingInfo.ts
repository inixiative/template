/**
 * @atlas
 * @kind controller
 * @partOf feature:setting
 * @uses primitive:routeTemplates
 */
import { SETTING_TREES, type SettingTrees } from '@template/shared/settings';
import { mapValues } from 'lodash-es';
import { descriptionsBySchemaFieldPath } from '#/lib/jsonSchema/descriptionsBySchemaFieldPath';
import { makeController } from '#/lib/utils/makeController';
import { settingInfoRoute } from '#/modules/setting/routes/settingInfo';
import { settingInfoResponseSchema } from '#/modules/setting/schemas/settingInfoResponseSchema';
import { settingTreeWithJsonSchemas } from '#/modules/setting/services/settingTreeWithJsonSchemas';

const guide = descriptionsBySchemaFieldPath(settingInfoResponseSchema);
const trees: SettingTrees = SETTING_TREES;

export const settingInfoController = makeController(settingInfoRoute, async (_c, respond) => {
  return respond.ok({
    guide,
    types: { trees: mapValues(trees, (tree) => settingTreeWithJsonSchemas(tree)) },
  });
});
