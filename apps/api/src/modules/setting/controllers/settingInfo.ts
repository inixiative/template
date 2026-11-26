/**
 * @atlas
 * @kind controller
 * @partOf feature:setting
 * @uses primitive:routeTemplates
 */
import { SETTING_TREES } from '@template/shared/settings';
import { descriptionsBySchemaFieldPath } from '#/lib/jsonSchema/descriptionsBySchemaFieldPath';
import { makeController } from '#/lib/utils/makeController';
import { settingInfoRoute } from '#/modules/setting/routes/settingInfo';
import { settingInfoResponseSchema } from '#/modules/setting/schemas/settingInfoResponseSchema';

const guide = descriptionsBySchemaFieldPath(settingInfoResponseSchema);

export const settingInfoController = makeController(settingInfoRoute, async (_c, respond) =>
  respond.ok({ guide, types: { trees: SETTING_TREES } }),
);
