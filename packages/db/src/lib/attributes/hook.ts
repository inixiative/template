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
import { validateAttributeWrite } from '@template/db/lib/attributes/codec';
import { ATTRIBUTE_MODELS, type AttributeModelName } from '@template/db/lib/attributes/registry';
import { type ModelName, toAccessor, toModelName } from '@template/db/utils/modelNames';
import { isPrismaNull } from '@template/db/utils/prismaNull';
import { castArray } from 'lodash-es';

type Row = Record<string, unknown>;

const attributeModelNames: ModelName[] = Object.keys(ATTRIBUTE_MODELS).map((accessor) =>
  toModelName(accessor),
);

const mergeUpdateOverPrevious = (previous: Row | undefined, data: Row): Row => {
  const merged: Row = { ...(previous ?? {}) };
  for (const [key, raw] of Object.entries(data)) {
    if (raw === undefined) continue;
    if (isPrismaNull(raw)) {
      merged[key] = null;
      continue;
    }
    if (
      raw !== null &&
      typeof raw === 'object' &&
      !Array.isArray(raw) &&
      !(raw instanceof Date) &&
      'set' in (raw as Row)
    ) {
      const setVal = (raw as { set: unknown }).set;
      merged[key] = isPrismaNull(setVal) ? null : setVal;
      continue;
    }
    merged[key] = raw;
  }
  return merged;
};

export type RegisterAttributeValidationHookOptions = {
  /** Optional custom error factory (e.g. API `makeError({ status: 422, message })`). */
  makeValidationError?: (message: string) => Error;
};

/**
 * Registers write-time invariant hooks across every model declared in `ATTRIBUTE_MODELS`:
 * - Enforces at most one populated typed value column (and exact schema match when code-defined)
 * - Deduplicates `multiSelect` arrays in `valueJson` and normalizes `date` values before persisting
 */
export const registerAttributeValidationHook = (
  options: RegisterAttributeValidationHookOptions = {},
): void => {
  if (attributeModelNames.length === 0) return;

  const toError = options.makeValidationError ?? ((message: string) => new Error(message));

  const validateAndNormalizeRow = (model: ModelName, mergedRow: Row, writableData?: Row): void => {
    const accessor = toAccessor(model) as AttributeModelName;
    const result = validateAttributeWrite(accessor, mergedRow);
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
    }
  };

  const processCreateArgs = (args: unknown, model: ModelName): void => {
    const data = (args as Row | null)?.data ?? (args as Row | null)?.create;
    if (!data || typeof data !== 'object') return;
    for (const row of castArray(data) as Row[]) {
      validateAndNormalizeRow(model, row, row);
    }
  };

  const processUpdateArgs = (args: unknown, model: ModelName, previous?: Row): void => {
    const data = ((args as Row | null)?.data ?? (args as Row | null)?.update) as Row | undefined;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return;
    const merged = mergeUpdateOverPrevious(previous, data);
    validateAndNormalizeRow(model, merged, data);
  };

  registerDbHook(
    'attributes:create',
    attributeModelNames,
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn],
    async ({ model, args }) => {
      processCreateArgs(args, model);
    },
  );

  registerDbHook(
    'attributes:update',
    attributeModelNames,
    HookTiming.before,
    [DbAction.update],
    async (hookOptions: HookOptions) => {
      const { model, args, previous } = hookOptions as HookOptions & { action: SingleAction };
      processUpdateArgs(args, model, previous as Row | undefined);
    },
  );

  registerDbHook(
    'attributes:upsert',
    attributeModelNames,
    HookTiming.before,
    [DbAction.upsert],
    async (hookOptions: HookOptions) => {
      const { model, args, previous } = hookOptions as HookOptions & { action: SingleAction };
      processCreateArgs(args, model);
      if (previous) {
        processUpdateArgs(args, model, previous as Row);
      }
    },
  );

  registerDbHook(
    'attributes:updateManyAndReturn',
    attributeModelNames,
    HookTiming.after,
    [DbAction.updateManyAndReturn],
    async ({ model, result }) => {
      for (const record of castArray(result ?? []) as Row[]) {
        validateAndNormalizeRow(model, record);
      }
    },
  );
};
