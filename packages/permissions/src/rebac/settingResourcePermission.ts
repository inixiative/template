/**
 * @atlas
 * @kind constructor
 * @constructs settingResourcePermissionFromDefinitions
 * @partOf primitive:authz
 * @uses none
 */
import { Operator } from '@inixiative/json-rules';
import type { ActionRule, ResourcePermission } from '@template/permissions/rebac/types';
import {
  SETTING_DEFINITIONS,
  type SettingDefinition,
  type SettingPermissionAction,
  type SettingResourceModelName,
} from '@template/shared/settings';

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

const perDefinition = (
  definitions: Record<string, SettingDefinition>,
  actionFor: (definition: SettingDefinition) => SettingPermissionAction,
): ActionRule => ({
  any: Object.entries(definitions).map(([key, definition]) => {
    const action = actionFor(definition);
    return {
      all: [
        isKey(key),
        { any: definition.resourceModels.map((model) => settingResourceModelRule(model, action)) },
      ],
    };
  }),
});

/**
 * Compiles `db:setting` ReBAC rules directly from `SETTING_DEFINITIONS`.
 * Exactly two actions exist on `db:setting`:
 * - `manage`: per-key write/delete authority, delegating `definition.permission` to each allowed `resource${model}`.
 * - `read`: anyone who can `manage` the setting, OR holds `definition.readPermission ?? 'read'` on `resource${model}`.
 */
export const settingResourcePermissionFromDefinitions = (
  definitions: Record<string, SettingDefinition>,
): ResourcePermission => ({
  actions: {
    manage: perDefinition(definitions, (definition) => definition.permission),
    read: {
      any: [
        'manage',
        perDefinition(definitions, (definition) => definition.readPermission ?? 'read'),
      ],
    },
  },
});

export const settingResourcePermission =
  settingResourcePermissionFromDefinitions(SETTING_DEFINITIONS);
