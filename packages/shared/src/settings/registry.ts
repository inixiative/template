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
  billing: defineSettingCategory({
    key: 'billing',
    label: 'Billing',
    description: 'Billing account visibility and sub-owner billing permissions.',
    order: 20,
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
  'billing.allowSpaceBilling': defineSetting({
    key: 'billing.allowSpaceBilling',
    category: 'billing',
    label: 'Allow Space Billing',
    description: 'Allow spaces in this organization to create and use their own billing accounts.',
    resourceModels: ['Organization'],
    valueType: 'boolean',
    schema: z.boolean(),
    defaultValue: false,
    order: 10,
    permission: 'manage',
  }),
  'billing.allowOrgUserBilling': defineSetting({
    key: 'billing.allowOrgUserBilling',
    category: 'billing',
    label: 'Allow Member Billing',
    description: 'Allow organization members to create and use their own billing accounts.',
    resourceModels: ['Organization'],
    valueType: 'boolean',
    schema: z.boolean(),
    defaultValue: false,
    order: 20,
    permission: 'manage',
  }),
  'billing.allowSpaceUserBilling': defineSetting({
    key: 'billing.allowSpaceUserBilling',
    category: 'billing',
    label: 'Allow Space Member Billing',
    description: 'Allow space members to create and use their own billing accounts.',
    resourceModels: ['Space', 'OrganizationUser'],
    valueType: 'boolean',
    schema: z.boolean(),
    defaultValue: false,
    order: 30,
    permission: { default: 'manage', OrganizationUser: 'operate' },
    readPermission: { default: 'read', OrganizationUser: 'operate' },
  }),
  'billing.shareAccountsWithMembers': defineSetting({
    key: 'billing.shareAccountsWithMembers',
    category: 'billing',
    label: 'Share Billing Accounts with Members',
    description: 'Default sharing policy for billing accounts set to inherit.',
    resourceModels: ['Organization', 'Space'],
    valueType: 'boolean',
    schema: z.boolean(),
    defaultValue: false,
    order: 40,
    permission: 'manage',
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

/** All setting definitions applicable to `resourceModel`, sorted by category order then setting order. */
export const settingDefinitionsForResourceModel = (
  resourceModel: SettingResourceModelName,
): SettingDefinition[] =>
  (Object.values(SETTING_DEFINITIONS) as SettingDefinition[])
    .filter((definition) => definition.resourceModels.includes(resourceModel))
    .sort((left, right) => {
      const leftCatOrder = settingCategoriesByKey[left.category]?.order ?? 0;
      const rightCatOrder = settingCategoriesByKey[right.category]?.order ?? 0;
      if (leftCatOrder !== rightCatOrder) return leftCatOrder - rightCatOrder;
      return left.order - right.order;
    });
