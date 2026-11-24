/**
 * @atlas
 * @kind registry
 * @partOf primitive:shared
 * @uses none
 */
import { attributePermissionForModel } from '@template/shared/attributes';
import { LanguageCodeSchema, TimezoneIdSchema } from '@template/shared/reference';
import type {
  SettingPermissionAction,
  SettingPermissionSpec,
  SettingResourceModelName,
} from '@template/shared/settings/resourceModels';
import {
  defineSetting,
  defineSettingCategory,
  type SettingCategoryDefinition,
  type SettingDefinition,
} from '@template/shared/settings/types';
import { z } from 'zod';

export const SETTING_CATEGORIES = {
  general: defineSettingCategory({
    key: 'general',
    label: 'General',
    description: 'Localization and general workspace defaults.',
    order: 10,
  }),
  // ==========================================================================
  // TEMPLATE ABOVE — Add app-specific setting categories below
  // ==========================================================================
} as const satisfies Record<string, SettingCategoryDefinition>;

export type SettingCategoryKey = keyof typeof SETTING_CATEGORIES;

export const SETTING_CATEGORY_KEYS = Object.keys(SETTING_CATEGORIES) as [
  SettingCategoryKey,
  ...SettingCategoryKey[],
];

export const SettingCategoryKeySchema = z.enum(SETTING_CATEGORY_KEYS);

export const SETTING_DEFINITIONS = {
  'general.defaultTimezone': defineSetting({
    key: 'general.defaultTimezone',
    category: 'general',
    label: 'Default Timezone',
    description: 'Canonical IANA timezone used for dates, schedules, and digests.',
    resourceModels: ['User', 'Organization', 'Space', 'Project'],
    valueType: 'text',
    schema: TimezoneIdSchema,
    defaultValue: 'UTC',
    order: 10,
    permission: 'manage',
  }),
  'general.displayLocale': defineSetting({
    key: 'general.displayLocale',
    category: 'general',
    label: 'Display Language',
    description: 'Preferred ISO-639-1 language code for copy and emails.',
    resourceModels: ['User', 'Organization', 'Space', 'OrganizationUser', 'SpaceUser'],
    valueType: 'text',
    schema: LanguageCodeSchema,
    defaultValue: 'en',
    order: 20,
    permission: { default: 'manage', OrganizationUser: 'operate', SpaceUser: 'operate' },
    readPermission: { default: 'read', OrganizationUser: 'operate', SpaceUser: 'operate' },
  }),
  // ==========================================================================
  // TEMPLATE ABOVE — Add app-specific setting definitions below
  // ==========================================================================
} as const satisfies Record<string, SettingDefinition<string, SettingCategoryKey>>;

export type SettingKey = keyof typeof SETTING_DEFINITIONS;

export const SETTING_KEYS = Object.keys(SETTING_DEFINITIONS) as [SettingKey, ...SettingKey[]];

export const SettingKeySchema = z.enum(SETTING_KEYS);

const settingDefinitionsByKey: Partial<Record<string, SettingDefinition>> = SETTING_DEFINITIONS;
const settingCategoriesByKey: Partial<Record<string, SettingCategoryDefinition>> =
  SETTING_CATEGORIES;

export const settingDefinitionForKey = (key: string): SettingDefinition | undefined =>
  settingDefinitionsByKey[key];

export const settingDefinitionForKeyOrThrow = (key: string): SettingDefinition => {
  const definition = settingDefinitionsByKey[key];
  if (!definition) throw new Error(`Unknown setting key: '${key}'`);
  return definition;
};

export const settingCategoryForKey = (key: string): SettingCategoryDefinition | undefined =>
  settingCategoriesByKey[key];

/** Resolves the concrete ReBAC action for `resourceModel` from a single action or per-model map. */
export const settingPermissionForModel = (
  spec: SettingPermissionSpec | undefined,
  resourceModel: SettingResourceModelName,
  fallback?: SettingPermissionAction,
): SettingPermissionAction => {
  const resolved = attributePermissionForModel(spec, resourceModel, fallback);
  if (!resolved) {
    throw new Error(
      `Setting permission spec has no action or default for resourceModel '${resourceModel}'`,
    );
  }
  return resolved;
};

export const settingAppliesToIntegrationProvider = (
  definition: { readonly key: string; readonly integrationProviders?: readonly string[] },
  integrationProvider: string | undefined,
): boolean =>
  !definition.integrationProviders ||
  (integrationProvider !== undefined &&
    definition.integrationProviders.includes(integrationProvider));

/**
 * All setting definitions applicable to `resourceModel` (and, for an Integration or
 * ProjectIntegration, to that integration's provider), sorted by category order then setting order.
 */
export const settingDefinitionsForResourceModel = (
  resourceModel: SettingResourceModelName,
  integrationProvider?: string,
): SettingDefinition[] =>
  (Object.values(SETTING_DEFINITIONS) as SettingDefinition[])
    .filter(
      (definition) =>
        definition.resourceModels.includes(resourceModel) &&
        settingAppliesToIntegrationProvider(definition, integrationProvider),
    )
    .sort((left, right) => {
      const leftCatOrder = settingCategoriesByKey[left.category]?.order ?? 0;
      const rightCatOrder = settingCategoriesByKey[right.category]?.order ?? 0;
      if (leftCatOrder !== rightCatOrder) return leftCatOrder - rightCatOrder;
      return left.order - right.order;
    });
