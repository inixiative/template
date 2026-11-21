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
  membership: defineSettingCategory({
    key: 'membership',
    label: 'Membership',
    description: 'Per-membership preferences for interacting with an organization or space.',
    order: 20,
  }),
  notifications: defineSettingCategory({
    key: 'notifications',
    label: 'Notifications',
    description: 'Notification topic subscriptions, quiet hours, and snooze windows.',
    order: 30,
  }),
  security: defineSettingCategory({
    key: 'security',
    label: 'Security',
    description: 'Organization-level access controls and authentication enforcement.',
    order: 40,
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

const NOTIFICATION_TOPICS = ['inquiries', 'security', 'billing', 'digest'] as const;

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
    resourceModels: ['User', 'Organization', 'Space'],
    valueType: 'text',
    schema: LanguageCodeSchema,
    defaultValue: 'en',
    order: 20,
    permission: 'manage',
  }),
  'member.autoAcceptInquiries': defineSetting({
    key: 'member.autoAcceptInquiries',
    category: 'membership',
    label: 'Auto-Accept Inquiries',
    description: 'Automatically accept eligible inquiries routed to this membership.',
    resourceModels: ['OrganizationUser', 'SpaceUser'],
    valueType: 'boolean',
    schema: z.boolean(),
    defaultValue: false,
    order: 10,
    permission: 'operate',
    readPermission: 'operate',
  }),
  'member.maxActiveTasks': defineSetting({
    key: 'member.maxActiveTasks',
    category: 'membership',
    label: 'Max Active Tasks',
    description: 'Upper limit on concurrent active tasks assigned to this membership.',
    resourceModels: ['OrganizationUser', 'SpaceUser'],
    valueType: 'number',
    schema: z.number().int().min(1).max(100),
    defaultValue: 10,
    order: 20,
    permission: 'operate',
    readPermission: 'operate',
  }),
  'notifications.topics': defineSetting({
    key: 'notifications.topics',
    category: 'notifications',
    label: 'Notification Topics',
    description: 'Subscribed event topics for alerts and activity feeds.',
    resourceModels: ['User', 'Organization', 'Space', 'OrganizationUser', 'SpaceUser', 'Project'],
    valueType: 'multiSelect',
    schema: z.array(z.enum(NOTIFICATION_TOPICS)),
    defaultValue: ['inquiries', 'security'] as (typeof NOTIFICATION_TOPICS)[number][],
    order: 10,
    permission: { default: 'manage', OrganizationUser: 'operate', SpaceUser: 'operate' },
    readPermission: { default: 'read', OrganizationUser: 'operate', SpaceUser: 'operate' },
  }),
  'notifications.quietHours': defineSetting({
    key: 'notifications.quietHours',
    category: 'notifications',
    label: 'Quiet Hours',
    description: 'Daily hour window (0-23) during which non-urgent notifications pause.',
    resourceModels: ['User', 'Organization', 'Project'],
    valueType: 'json',
    schema: z.object({
      enabled: z.boolean(),
      startHour: z.number().int().min(0).max(23),
      endHour: z.number().int().min(0).max(23),
    }),
    defaultValue: { enabled: false, startHour: 22, endHour: 8 },
    order: 20,
    permission: 'manage',
  }),
  'notifications.snoozeUntil': defineSetting({
    key: 'notifications.snoozeUntil',
    category: 'notifications',
    label: 'Snooze Notifications Until',
    description: 'Timestamp until which non-urgent notifications are paused.',
    resourceModels: ['User', 'Organization', 'Space', 'Project'],
    valueType: 'date',
    schema: z.iso.datetime(),
    defaultValue: null,
    order: 30,
    permission: 'manage',
  }),
  'notifications.digestPaused': defineSetting({
    key: 'notifications.digestPaused',
    category: 'notifications',
    label: 'Digest Paused',
    description: 'Temporarily pause scheduled workspace digest notifications.',
    resourceModels: ['Organization', 'Space', 'Project'],
    valueType: 'boolean',
    schema: z.boolean(),
    defaultValue: false,
    order: 40,
    permission: 'operate',
  }),
  'security.requireSso': defineSetting({
    key: 'security.requireSso',
    category: 'security',
    label: 'Require SSO',
    description: 'Require members of this organization to sign in via single sign-on.',
    resourceModels: ['Organization'],
    valueType: 'boolean',
    schema: z.boolean(),
    defaultValue: false,
    order: 10,
    permission: 'own',
    readPermission: 'manage',
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
