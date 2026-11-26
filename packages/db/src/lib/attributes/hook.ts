/**
 * @atlas
 * @kind hook
 * @partOf infrastructure:prisma
 * @uses infrastructure:prisma
 */
import {
  DbAction,
  type HookOptions,
  HookTiming,
  registerDbHook,
  type SingleAction,
} from '@template/db/extensions/hookRegistry';
import {
  ATTRIBUTE_MODELS,
  type AttributeModelName,
  attributeModelConfig,
} from '@template/db/lib/attributes/registry';
import { validateAttributeWrite } from '@template/db/lib/attributes/writing/validateAttributeWrite';
import { applyWriteDataOverPreviousRow } from '@template/db/utils/applyWriteDataOverPreviousRow';
import { isTombstoneOnlyUpdate } from '@template/db/utils/isTombstoneOnlyUpdate';
import { type ModelName, toAccessor, toModelName } from '@template/db/utils/modelNames';
import {
  type AttributeFieldDefinition,
  AttributeValidationError,
  deduplicateMultiSelect,
  isStringArray,
} from '@template/shared/attributes';
import { castArray } from 'lodash-es';

type Row = Record<string, unknown>;

const attributeModelNames: ModelName[] = Object.keys(ATTRIBUTE_MODELS).map((accessor) =>
  toModelName(accessor),
);

const extractScalarWhereValue = (where: Row | undefined, field: string): string | undefined => {
  const raw = where?.[field];
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && typeof (raw as Row).equals === 'string') {
    return (raw as Row).equals as string;
  }
  return undefined;
};

const arraysEqual = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((item, idx) => item === right[idx]);

export type RegisterAttributeValidationHookOptions = {
  /** Optional definition resolver override (used in unit/DB tests with synthetic definitions). */
  resolveDefinition?: (locator: string) => AttributeFieldDefinition | undefined;
};

/**
 * Registers write-time invariant hooks across every model declared in `ATTRIBUTE_MODELS`:
 * - Enforces at most one populated typed value column (and exact schema match when code-defined)
 * - Deduplicates & canonically sorts `multiSelect` arrays in `valueJson` and normalizes `date` values
 * - Skips re-validation on tombstone-only (`{ deletedAt }`) updates so soft-delete cascades & revives never fail
 */
export const registerAttributeValidationHook = (
  options: RegisterAttributeValidationHookOptions = {},
): void => {
  if (attributeModelNames.length === 0) return;

  const validationOptions = options.resolveDefinition
    ? { resolveDefinition: options.resolveDefinition }
    : undefined;

  const definitionHeldByRowResource = async (
    model: ModelName,
    row: Row,
  ): Promise<AttributeFieldDefinition | undefined> => {
    const config = attributeModelConfig(toAccessor(model) as AttributeModelName);
    if (options.resolveDefinition || !config.fetchDefinitionForRow || !config.locatorField) return;
    const locator = row[config.locatorField];
    if (typeof locator !== 'string' || !locator) return;
    const definition = await config.fetchDefinitionForRow(row);
    if (definition) return definition;
    const resourceModel = config.resourceModelField ? row[config.resourceModelField] : undefined;
    throw new AttributeValidationError([
      {
        code: 'attribute_locator_not_held_by_resource',
        message: `${model} ${config.locatorField} '${locator}' is not defined on this ${String(resourceModel ?? 'resource')}`,
        path: [config.locatorField],
      },
    ]);
  };

  const validateAndNormalizeRow = async (
    model: ModelName,
    mergedRow: Row,
    writableData?: Row,
  ): Promise<void> => {
    const accessor = toAccessor(model) as AttributeModelName;
    const heldDefinition = await definitionHeldByRowResource(model, mergedRow);
    const result = validateAttributeWrite(
      accessor,
      mergedRow,
      heldDefinition ? { resolveDefinition: () => heldDefinition } : validationOptions,
    );
    if (writableData) {
      if (result.normalizedValueJson !== undefined && writableData.valueJson !== undefined) {
        writableData.valueJson = result.normalizedValueJson;
      }
      if (result.normalizedValueDate !== undefined && writableData.valueDate !== undefined) {
        writableData.valueDate = result.normalizedValueDate;
      }
    } else if (result.normalizedValueJson !== undefined) {
      const persisted = mergedRow.valueJson;
      if (!isStringArray(persisted) || !arraysEqual(persisted, result.normalizedValueJson)) {
        const config = attributeModelConfig(accessor);
        throw new AttributeValidationError([
          {
            code: 'unsorted_multiselect_value',
            message: `${model}: multiSelect valueJson must be deduplicated and canonically sorted (expected ${JSON.stringify(result.normalizedValueJson)}; scope where by '${config.locatorField ?? 'key'}' or pass deduplicateMultiSelect)`,
            path: ['valueJson'],
          },
        ]);
      }
    }
  };

  const processCreateData = async (data: unknown, model: ModelName): Promise<void> => {
    if (!data || typeof data !== 'object') return;
    for (const row of castArray(data) as Row[]) {
      await validateAndNormalizeRow(model, row, row);
    }
  };

  const processUpdateData = async (
    data: unknown,
    model: ModelName,
    previous?: Row,
  ): Promise<void> => {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return;
    const writable = data as Row;
    if (isTombstoneOnlyUpdate(writable)) return;
    const merged = applyWriteDataOverPreviousRow(previous, writable, { model });
    await validateAndNormalizeRow(model, merged, writable);
  };

  registerDbHook(
    'attributes:create',
    attributeModelNames,
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn],
    async ({ model, args }) => {
      await processCreateData((args as Row | null)?.data, model);
    },
  );

  registerDbHook(
    'attributes:update',
    attributeModelNames,
    HookTiming.before,
    [DbAction.update],
    async (hookOptions: HookOptions) => {
      const { model, args, previous } = hookOptions as HookOptions & { action: SingleAction };
      await processUpdateData((args as Row | null)?.data, model, previous as Row | undefined);
    },
  );

  registerDbHook(
    'attributes:upsert',
    attributeModelNames,
    HookTiming.before,
    [DbAction.upsert],
    async (hookOptions: HookOptions) => {
      const { model, args, previous } = hookOptions as HookOptions & { action: SingleAction };
      const upsertArgs = args as Row | null;
      if (previous) {
        await processUpdateData(upsertArgs?.update, model, previous as Row);
      } else {
        await processCreateData(upsertArgs?.create, model);
      }
    },
  );

  registerDbHook(
    'attributes:updateManyAndReturn:before',
    attributeModelNames,
    HookTiming.before,
    [DbAction.updateManyAndReturn],
    async ({ model, args }) => {
      const updateArgs = args as Row | null;
      const data = updateArgs?.data as Row | undefined;
      if (!data || typeof data !== 'object' || Array.isArray(data)) return;
      if (isTombstoneOnlyUpdate(data)) return;
      if (!isStringArray(data.valueJson)) return;

      const config = attributeModelConfig(model);
      const resolveDef = options.resolveDefinition ?? config.resolveDefinition;
      const where = updateArgs?.where as Row | undefined;
      const locator = config.locatorField
        ? extractScalarWhereValue(where, config.locatorField)
        : undefined;
      const definition = locator && resolveDef ? resolveDef(locator) : undefined;
      const rowValueType = config.valueTypeField
        ? (data[config.valueTypeField] ?? extractScalarWhereValue(where, config.valueTypeField))
        : undefined;

      if (definition?.valueType === 'multiSelect' || rowValueType === 'multiSelect') {
        data.valueJson = deduplicateMultiSelect(data.valueJson);
      }
    },
  );

  registerDbHook(
    'attributes:updateManyAndReturn',
    attributeModelNames,
    HookTiming.after,
    [DbAction.updateManyAndReturn],
    async ({ model, args, result }) => {
      const data = (args as Row | null)?.data;
      if (isTombstoneOnlyUpdate(data)) return;
      for (const record of castArray(result ?? []) as Row[]) {
        await validateAndNormalizeRow(model, record);
      }
    },
  );
};
