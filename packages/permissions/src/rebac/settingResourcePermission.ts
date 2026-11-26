/**
 * @atlas
 * @kind constructor
 * @constructs settingResourcePermissionFromTrees
 * @partOf primitive:authz
 * @uses none
 */
import { Operator } from '@inixiative/json-rules';
import type { ActionRule, ResourcePermission } from '@template/permissions/rebac/types';
import {
  SETTING_RESOURCE_MODELS,
  SETTING_TREES,
  type SettingDefinition,
  type SettingPermissionAction,
  type SettingResourceModelName,
  type SettingTrees,
  settingsIn,
} from '@template/shared/settings';
import { groupBy, uniqBy } from 'lodash-es';

const isKey = (key: string): ActionRule => ({
  rule: { field: 'key', operator: Operator.equals, value: key },
});

const isResourceModel = (model: SettingResourceModelName): ActionRule => ({
  rule: { field: 'resourceModel', operator: Operator.equals, value: model },
});

/** Rule granting `action` on `resource${model}`, gated on `resourceModel === model`. */
export const settingResourceModelRule = (
  model: SettingResourceModelName,
  action: SettingPermissionAction,
): ActionRule => ({
  all: [isResourceModel(model), { rel: `resource${model}`, action }],
});

type Placement = { model: SettingResourceModelName; definition: SettingDefinition };

const perKey = (
  placements: readonly Placement[],
  actionOf: (definition: SettingDefinition) => SettingPermissionAction,
): ActionRule => ({
  any: Object.entries(groupBy(placements, ({ definition }) => definition.key)).map(
    ([key, held]) => ({
      all: [
        isKey(key),
        {
          any: held.map(({ model, definition }) =>
            settingResourceModelRule(model, actionOf(definition)),
          ),
        },
      ],
    }),
  ),
});

export const settingResourcePermissionFromTrees = (trees: SettingTrees): ResourcePermission => {
  const placements = SETTING_RESOURCE_MODELS.flatMap((model) =>
    uniqBy(settingsIn(trees[model], 'every'), 'key').map((definition) => ({
      model,
      definition,
    })),
  );
  return {
    actions: {
      manage: perKey(placements, (definition) => definition.manage),
      read: { any: ['manage', perKey(placements, (definition) => definition.read)] },
    },
  };
};

export const settingResourcePermission = settingResourcePermissionFromTrees(SETTING_TREES);
