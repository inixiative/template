/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { AttributeModelConfig } from '@template/db/lib/attributes/types';
import { fetchSettingDefinitionForRow } from '@template/db/lib/settings/fetchSettingDefinitionForRow';
import type { ModelName } from '@template/db/utils/modelNames';
import { ATTRIBUTE_COLUMN_NAMES } from '@template/shared/attributes';
import { SETTING_RESOURCE_MODELS, SETTING_TREES, settingAt } from '@template/shared/settings';
import { lowerFirst, mapKeys, mapValues, upperFirst } from 'lodash-es';

/**
 * Registry of Prisma models opting into the 5-column Attribute capability
 * (`valueBoolean`, `valueText`, `valueNumber`, `valueDate`, `valueJson`),
 * mirroring `ENCRYPTED_MODELS` in `packages/db/src/lib/encryption/registry.ts`.
 */
export const ATTRIBUTE_MODELS = {
  setting: {
    model: 'setting',
    locatorField: 'key',
    resourceModelField: 'resourceModel',
    disabledField: 'disabled',
    resolveDefinition: (key: string) =>
      SETTING_RESOURCE_MODELS.map((model) => settingAt(SETTING_TREES[model], key, 'every')).find(
        Boolean,
      ),
    fetchDefinitionForRow: fetchSettingDefinitionForRow,
  } satisfies AttributeModelConfig<'setting'>,
  // ==========================================================================
  // TEMPLATE ABOVE — Register app-specific attribute models below
  // ==========================================================================
} as const;

export type AttributeModelName = keyof typeof ATTRIBUTE_MODELS;

const attributeModelsByAccessor: Partial<Record<string, AttributeModelConfig>> = ATTRIBUTE_MODELS;

/** Returns true if `model` (accessor or PascalCase model name) is registered in ATTRIBUTE_MODELS. */
export const isAttributeModel = (model: string): boolean =>
  lowerFirst(model) in attributeModelsByAccessor;

/** Returns the AttributeModelConfig for a registered accessor or PascalCase model name. */
export const attributeModelConfig = (
  model: AttributeModelName | ModelName,
): AttributeModelConfig => {
  const config = attributeModelsByAccessor[lowerFirst(model)];
  if (!config) throw new Error(`Model '${model}' is not registered in ATTRIBUTE_MODELS`);
  return config;
};

/**
 * Derives `{ ModelName: [locatorField?, ...ATTRIBUTE_COLUMN_NAMES] }` from `ATTRIBUTE_MODELS`
 * (mirroring `encryptedFieldsByModel()`). Keys are PascalCase Prisma model names.
 */
export const attributeFieldsByModel = (): Record<string, string[]> =>
  mapValues(
    mapKeys(ATTRIBUTE_MODELS, (_config, accessorName) => upperFirst(accessorName)),
    (modelConfig) => [
      ...(modelConfig.locatorField ? [modelConfig.locatorField] : []),
      ...ATTRIBUTE_COLUMN_NAMES,
    ],
  );
