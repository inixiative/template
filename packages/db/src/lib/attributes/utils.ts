/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import {
  decodeStoredAttributeValue,
  encodeResolvedAttributeColumns,
} from '@template/db/lib/attributes/codec';
import {
  type AttributeModelName,
  attributeModelConfig,
} from '@template/db/lib/attributes/registry';
import type { EffectiveAttributeEntry } from '@template/db/lib/attributes/types';
import type { ModelName } from '@template/db/utils/modelNames';
import { type AttributeValueType, attributePermissionForModel } from '@template/shared/attributes';

type ResolveEffectiveOptions = {
  category?: string;
  key?: string;
};

export type ResolvedEffectiveAttributes = {
  items: EffectiveAttributeEntry[];
  byCategory: Record<string, EffectiveAttributeEntry[]>;
};

/**
 * Merges stored attribute rows for a target resource with code-defined defaults,
 * respecting `disabled` flags and optional `category`/`key` filters.
 */
export const resolveEffectiveAttributeValues = (
  model: AttributeModelName | ModelName,
  resourceModel: string,
  rows: readonly Record<string, unknown>[],
  options: ResolveEffectiveOptions = {},
): ResolvedEffectiveAttributes => {
  const config = attributeModelConfig(model);
  const definitions = config.definitionsForResourceModel?.(resourceModel) ?? [];

  const rowByLocator = new Map<string, Record<string, unknown>>();
  if (config.locatorField) {
    for (const row of rows) {
      const locator = row[config.locatorField];
      if (typeof locator === 'string') rowByLocator.set(locator, row);
    }
  }

  const filtered = definitions.filter((definition) => {
    if (options.category && definition.category !== options.category) return false;
    if (options.key && definition.key !== options.key) return false;
    return true;
  });

  const items: EffectiveAttributeEntry[] = filtered.map((definition) => {
    const row = rowByLocator.get(definition.key);
    const disabled = Boolean(config.disabledField && row?.[config.disabledField] === true);
    const storedValue = row ? decodeStoredAttributeValue(model, row) : null;
    const isDefault = !row || disabled || storedValue === null;
    const value = isDefault ? definition.defaultValue : storedValue;

    return {
      key: definition.key,
      category: definition.category ?? null,
      valueType: definition.valueType,
      label: definition.label,
      description: definition.description,
      order: definition.order ?? 0,
      permission: attributePermissionForModel(definition.permission, resourceModel) ?? null,
      defaultValue: definition.defaultValue,
      value,
      storedValue,
      disabled,
      isDefault,
      recordId: typeof row?.id === 'string' ? row.id : null,
      updatedAt: row?.updatedAt instanceof Date ? row.updatedAt : null,
    };
  });

  const byCategory: Record<string, EffectiveAttributeEntry[]> = {};
  for (const item of items) {
    const bucket = item.category ?? 'uncategorized';
    const existing = byCategory[bucket];
    if (existing) existing.push(item);
    else byCategory[bucket] = [item];
  }

  return { items, byCategory };
};

export type BuildAttributeUpsertDataOptions = {
  resourceModel?: string;
  disabled?: boolean;
  valueType?: AttributeValueType;
};

/**
 * Validates `locator` (+ optional `resourceModel` applicability) and builds the 5-column
 * write payload for creating or updating an Attribute row.
 */
export const buildAttributeUpsertData = (
  model: AttributeModelName | ModelName,
  locator: string,
  value: unknown,
  options: BuildAttributeUpsertDataOptions = {},
): Record<string, unknown> => {
  const config = attributeModelConfig(model);
  const definition = config.resolveDefinition ? config.resolveDefinition(locator) : undefined;

  if (config.resolveDefinition && !definition) {
    throw new Error(`Unknown attribute locator '${locator}' for model '${config.model}'`);
  }

  if (
    options.resourceModel &&
    definition?.resourceModels?.length &&
    !definition.resourceModels.includes(options.resourceModel)
  ) {
    throw new Error(
      `${config.model} '${locator}' is not valid for resourceModel '${options.resourceModel}'`,
    );
  }

  const columns = encodeResolvedAttributeColumns(config, locator, definition, value, {
    valueType: options.valueType,
  });
  return {
    ...columns,
    ...(config.disabledField && options.disabled !== undefined
      ? { [config.disabledField]: options.disabled }
      : {}),
  };
};
