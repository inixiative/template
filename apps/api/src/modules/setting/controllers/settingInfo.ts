/**
 * @atlas
 * @kind controller
 * @partOf feature:setting
 * @uses primitive:routeTemplates
 */
import type { SettingResourceModel } from '@template/db/generated/client/enums';
import {
  SETTING_CATEGORIES,
  SETTING_DEFINITIONS,
  type SettingDefinition,
} from '@template/shared/settings';
import { mapValues } from 'lodash-es';
import { descriptionsBySchemaFieldPath } from '#/lib/jsonSchema/descriptionsBySchemaFieldPath';
import { toJsonSchema } from '#/lib/jsonSchema/toJsonSchema';
import { makeController } from '#/lib/utils/makeController';
import { settingInfoRoute } from '#/modules/setting/routes/settingInfo';
import { settingInfoResponseSchema } from '#/modules/setting/schemas/settingInfoResponseSchema';

const guide = descriptionsBySchemaFieldPath(settingInfoResponseSchema);

export const settingInfoController = makeController(settingInfoRoute, async (_c, respond) => {
  return respond.ok({
    guide,
    types: {
      categories: SETTING_CATEGORIES,
      definitions: mapValues(SETTING_DEFINITIONS, (definition) => ({
        key: definition.key,
        category: definition.category,
        label: definition.label,
        description: definition.description,
        resourceModels: [...definition.resourceModels] as SettingResourceModel[],
        valueType: definition.valueType,
        schema: toJsonSchema(definition.schema, 'input'),
        defaultValue: definition.defaultValue,
        order: definition.order,
        permission: definition.permission,
        readPermission: (definition as SettingDefinition).readPermission ?? 'read',
      })),
    },
  });
});
