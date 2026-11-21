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
import { attributeWriteInspection } from '@template/db/lib/attributes/codec';
import {
  ATTRIBUTE_MODELS,
  type AttributeModelName,
  attributeModelConfig,
} from '@template/db/lib/attributes/registry';
import { applyWriteDataOverPreviousRow } from '@template/db/utils/applyWriteDataOverPreviousRow';
import { type ModelName, toAccessor, toModelName } from '@template/db/utils/modelNames';
import { deduplicateMultiSelect, isStringArray } from '@template/shared/attributes';
import { castArray } from 'lodash-es';

type Row = Record<string, unknown>;

const attributeModelNames: ModelName[] = Object.keys(ATTRIBUTE_MODELS).map((accessor) =>
  toModelName(accessor),
);

const isTombstoneOnlyUpdate = (data: Row): boolean => {
  const keys = Object.keys(data).filter((key) => data[key] !== undefined);
  return keys.length > 0 && keys.every((key) => key === 'deletedAt');
};

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
  /** Optional custom error factory (e.g. API `makeError({ status: 422, message })`). */
  makeValidationError?: (message: string) => Error;
};

/**
 * Registers write-time invariant hooks across every model declared in `ATTRIBUTE_MODELS`:
 * - Enforces at most one populated typed value column (and exact schema match when code-defined)
 * - Deduplicates & canonically sorts `multiSelect` arrays in `valueJson` and normalizes `date` values
 * - Skips re-validation on tombstone-only (`{ deletedAt }`) updates so soft-delete cascades never fail
 */
export const registerAttributeValidationHook = (
  options: RegisterAttributeValidationHookOptions = {},
): void => {
  if (attributeModelNames.length === 0) return;

  const toError = options.makeValidationError ?? ((message: string) => new Error(message));

  const validateAndNormalizeRow = (model: ModelName, mergedRow: Row, writableData?: Row): void => {
    const accessor = toAccessor(model) as AttributeModelName;
    const result = attributeWriteInspection(accessor, mergedRow);
    if (!result.ok) {
      throw toError(result.errors.join('; '));
    }
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
        throw toError(
          `${model}: multiSelect valueJson must be deduplicated and canonically sorted (expected ${JSON.stringify(result.normalizedValueJson)}; scope where by '${config.locatorField ?? 'key'}' or pass deduplicateMultiSelect)`,
        );
      }
    }
  };

  const processCreateData = (data: unknown, model: ModelName): void => {
    if (!data || typeof data !== 'object') return;
    for (const row of castArray(data) as Row[]) {
      validateAndNormalizeRow(model, row, row);
    }
  };

  const processUpdateData = (data: unknown, model: ModelName, previous?: Row): void => {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return;
    const writable = data as Row;
    if (isTombstoneOnlyUpdate(writable)) return;
    const merged = applyWriteDataOverPreviousRow(previous, writable, { model });
    validateAndNormalizeRow(model, merged, writable);
  };

  registerDbHook(
    'attributes:create',
    attributeModelNames,
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn],
    async ({ model, args }) => {
      processCreateData((args as Row | null)?.data, model);
    },
  );

  registerDbHook(
    'attributes:update',
    attributeModelNames,
    HookTiming.before,
    [DbAction.update],
    async (hookOptions: HookOptions) => {
      const { model, args, previous } = hookOptions as HookOptions & { action: SingleAction };
      processUpdateData((args as Row | null)?.data, model, previous as Row | undefined);
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
        processUpdateData(upsertArgs?.update, model, previous as Row);
      } else {
        processCreateData(upsertArgs?.create, model);
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
      const where = updateArgs?.where as Row | undefined;
      const locator = config.locatorField
        ? extractScalarWhereValue(where, config.locatorField)
        : undefined;
      const definition =
        locator && config.resolveDefinition ? config.resolveDefinition(locator) : undefined;
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
      const data = (args as Row | null)?.data as Row | undefined;
      if (data && typeof data === 'object' && !Array.isArray(data) && isTombstoneOnlyUpdate(data)) {
        return;
      }
      for (const record of castArray(result ?? []) as Row[]) {
        validateAndNormalizeRow(model, record);
      }
    },
  );
};
