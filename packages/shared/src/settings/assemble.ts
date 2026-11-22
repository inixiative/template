/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */
import {
  type AttributePermissionSpec,
  type AttributeValueType,
  attributePermissionForModel,
  decodeAttributeColumnValue,
  deduplicateMultiSelect,
  isStringArray,
  parseAttributeDate,
} from '@template/shared/attributes';
import type {
  SettingPermissionAction,
  SettingResourceModelName,
} from '@template/shared/settings/resourceModels';
import { isEqual } from 'lodash-es';

export type SettingCatalogCategory = {
  readonly key: string;
  readonly label: string;
  readonly description: string;
  readonly order: number;
};

export type SettingCatalogDefinition = {
  readonly key: string;
  readonly category: string;
  readonly label: string;
  readonly description: string;
  readonly resourceModels: readonly string[];
  readonly valueType: AttributeValueType;
  readonly schema: Record<string, unknown>;
  readonly defaultValue?: unknown;
  readonly order: number;
  readonly permission: AttributePermissionSpec<SettingPermissionAction>;
  readonly readPermission?: AttributePermissionSpec<SettingPermissionAction>;
};

export type SettingCatalog = {
  readonly categories: Readonly<Record<string, SettingCatalogCategory>>;
  readonly definitions: Readonly<Record<string, SettingCatalogDefinition>>;
};

export type RawSettingRow = {
  readonly id: string;
  readonly key: string;
  readonly disabled: boolean;
  readonly valueBoolean: boolean | null;
  readonly valueText: string | null;
  readonly valueNumber: number | null;
  readonly valueDate: Date | string | null;
  readonly valueJson?: unknown;
  readonly updatedAt?: Date | string | null;
};

export type AssembledSettingItem = {
  key: string;
  category: string;
  valueType: AttributeValueType;
  label: string;
  description: string;
  order: number;
  permission: SettingPermissionAction;
  readPermission: SettingPermissionAction;
  schema: Record<string, unknown>;
  defaultValue: unknown;
  value: unknown;
  storedValue: unknown;
  disabled: boolean;
  isDefault: boolean;
  settingId: string | null;
  updatedAt: Date | null;
};

export type AssembledResourceSettings = {
  items: AssembledSettingItem[];
  byCategory: Record<string, AssembledSettingItem[]>;
};

export type AssembleResourceSettingsOptions = {
  category?: string;
  keys?: readonly string[];
};

export type SettingUpsertDraftItem = {
  key: string;
  value: unknown;
  disabled?: boolean;
};

/**
 * Pure Cardi-style assembly helper: merges master-data `catalog` (from `GET /api/v1/setting/info`)
 * with raw `Setting[]` rows for a target `resourceModel`, applying defaults when a row is absent
 * or `disabled`, and sorting deterministically by category order then definition order.
 */
export const assembleResourceSettings = (
  catalog: SettingCatalog,
  rawRows: readonly RawSettingRow[],
  resourceModel: SettingResourceModelName | string,
  options: AssembleResourceSettingsOptions = {},
): AssembledResourceSettings => {
  const rowByKey = new Map<string, RawSettingRow>();
  for (const row of rawRows) {
    rowByKey.set(row.key, row);
  }

  const keyFilter = options.keys ? new Set(options.keys) : null;
  const matching = Object.values(catalog.definitions)
    .filter((definition) => {
      if (!definition.resourceModels.includes(resourceModel)) return false;
      if (options.category && definition.category !== options.category) return false;
      if (keyFilter && !keyFilter.has(definition.key)) return false;
      return true;
    })
    .sort((left, right) => {
      const leftCatOrder = catalog.categories[left.category]?.order ?? 0;
      const rightCatOrder = catalog.categories[right.category]?.order ?? 0;
      if (leftCatOrder !== rightCatOrder) return leftCatOrder - rightCatOrder;
      return left.order - right.order;
    });

  const items: AssembledSettingItem[] = matching.map((definition) => {
    const row = rowByKey.get(definition.key);
    const disabled = Boolean(row?.disabled);
    const storedValue = row ? decodeAttributeColumnValue(definition.valueType, row) : null;
    const defaultValue = definition.defaultValue ?? null;
    const isDefault = !row || disabled || storedValue === null;
    const value = isDefault ? defaultValue : storedValue;

    return {
      key: definition.key,
      category: definition.category,
      valueType: definition.valueType,
      label: definition.label,
      description: definition.description,
      order: definition.order,
      permission: attributePermissionForModel(definition.permission, resourceModel) ?? 'manage',
      readPermission:
        attributePermissionForModel(definition.readPermission, resourceModel, 'read') ?? 'read',
      schema: definition.schema,
      defaultValue,
      value,
      storedValue,
      disabled,
      isDefault,
      settingId: row?.id ?? null,
      updatedAt: row?.updatedAt ? parseAttributeDate(row.updatedAt) : null,
    };
  });

  const byCategory: Record<string, AssembledSettingItem[]> = {};
  for (const item of items) {
    const bucket = byCategory[item.category];
    if (bucket) bucket.push(item);
    else byCategory[item.category] = [item];
  }

  return { items, byCategory };
};

const normalizeForDiff = (valueType: AttributeValueType, value: unknown): unknown => {
  if (value === null || value === undefined) return null;
  if (valueType === 'multiSelect' && isStringArray(value)) {
    return deduplicateMultiSelect(value);
  }
  if (valueType === 'date') {
    return parseAttributeDate(value)?.toISOString() ?? value;
  }
  return value;
};

/**
 * Computes the minimal batch `PATCH` payload containing ONLY settings whose draft value
 * differs from the assembled effective value.
 */
export const diffSettingDrafts = (
  assembled: readonly AssembledSettingItem[],
  drafts: Readonly<Record<string, unknown>>,
): SettingUpsertDraftItem[] => {
  const dirty: SettingUpsertDraftItem[] = [];
  for (const item of assembled) {
    if (!(item.key in drafts)) continue;
    const draftValue = drafts[item.key];
    if (draftValue === undefined) continue;
    const currentNormalized = normalizeForDiff(item.valueType, item.value);
    const draftNormalized = normalizeForDiff(item.valueType, draftValue);
    if (!isEqual(currentNormalized, draftNormalized)) {
      dirty.push({
        key: item.key,
        value:
          item.valueType === 'multiSelect' && isStringArray(draftValue)
            ? deduplicateMultiSelect(draftValue)
            : item.valueType === 'date'
              ? (parseAttributeDate(draftValue)?.toISOString() ?? draftValue)
              : draftValue,
        ...(item.disabled ? { disabled: false } : {}),
      });
    }
  }
  return dirty;
};
