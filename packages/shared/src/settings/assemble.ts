/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */
import {
  type AttributeValueType,
  decodeAttributeColumnValue,
  deduplicateMultiSelect,
  isStringArray,
  parseAttributeDate,
} from '@template/shared/attributes';
import { settingsIn } from '@template/shared/settings/settingsIn';
import type {
  SettingDefinition,
  SettingResourceKinds,
  SettingTree,
} from '@template/shared/settings/types';
import { isEqual } from 'lodash-es';

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

export type AssembledSettingItem = SettingDefinition & {
  value: unknown;
  storedValue: unknown;
  disabled: boolean;
  isDefault: boolean;
  settingId: string | null;
  updatedAt: Date | null;
};

export type AssembleResourceSettingsOptions = {
  kinds?: SettingResourceKinds;
  path?: string;
};

export type SettingUpsertDraftItem = {
  key: string;
  value: unknown;
  disabled?: boolean;
};

export const assembleResourceSettings = (
  tree: SettingTree,
  rawRows: readonly RawSettingRow[],
  options: AssembleResourceSettingsOptions = {},
): AssembledSettingItem[] => {
  const rowByKey = new Map(rawRows.map((row) => [row.key, row]));

  return settingsIn(tree, options.kinds ?? {}, options.path).map((definition) => {
    const row = rowByKey.get(definition.key);
    const disabled = Boolean(row?.disabled);
    const storedValue = row ? decodeAttributeColumnValue(definition.valueType, row) : null;
    const defaultValue = definition.defaultValue ?? null;
    const isDefault = !row || disabled || storedValue === null;
    return {
      ...definition,
      defaultValue,
      value: isDefault ? defaultValue : storedValue,
      storedValue,
      disabled,
      isDefault,
      settingId: row?.id ?? null,
      updatedAt: row?.updatedAt ? parseAttributeDate(row.updatedAt) : null,
    };
  });
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
