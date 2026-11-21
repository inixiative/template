import { type Condition, check } from '@inixiative/json-rules';
import {
  applyWriteDataOverPreviousRow,
  DbAction,
  dualPolymorphismIdColumns,
  dualPolymorphismIdConflicts,
  type HookOptions,
  HookTiming,
  isPrismaNull,
  type ModelName,
  registerDbHook,
  type SingleAction,
  withDiscriminatorDefaults,
  withDualPolymorphismIds,
} from '@template/db';
import { castArray, without } from 'lodash-es';
import { RulesRegistry, ruleForModel } from '#/hooks/rules/registry';
import { makeError } from '#/lib/errors';

const evaluate = (rule: Condition, row: Record<string, unknown>): boolean | string => {
  try {
    return check(rule, row);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

const validateRules = (data: Record<string, unknown>, model: ModelName): void => {
  const result = evaluate(
    ruleForModel(model),
    Object.fromEntries(
      Object.entries(data).map(([field, value]) => [field, isPrismaNull(value) ? null : value]),
    ),
  );
  if (result !== true)
    throw makeError({
      status: 422,
      message: typeof result === 'string' ? result : `Validation failed on ${model}`,
    });
};

const processCreateArgs = (args: unknown, model: ModelName): void => {
  const data = (args as Record<string, unknown>)?.data ?? (args as Record<string, unknown>)?.create;
  if (!data || typeof data !== 'object') return;
  for (const row of castArray(data) as Record<string, unknown>[]) {
    const defaulted = withDiscriminatorDefaults(model, row);
    validateRules(defaulted, model);
    const [conflict] = dualPolymorphismIdConflicts(model, defaulted);
    if (conflict) throw makeError({ status: 422, message: conflict });
    const withIds = withDualPolymorphismIds(model, defaulted);
    for (const column of dualPolymorphismIdColumns(model))
      if (withIds[column] != null) row[column] = withIds[column];
  }
};

const processUpdateArgs = (
  args: unknown,
  model: ModelName,
  previous?: Record<string, unknown>,
): void => {
  const data = ((args as Record<string, unknown>)?.data ??
    (args as Record<string, unknown>)?.update) as Record<string, unknown> | undefined;
  if (data && typeof data === 'object' && !Array.isArray(data))
    validateRules(applyWriteDataOverPreviousRow(previous, data, { model }), model);
};

export const registerRulesHook = () => {
  const models = without(Object.keys(RulesRegistry), 'AuditLog');

  registerDbHook(
    'rules:create',
    models,
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn],
    async ({ model, args }) => {
      processCreateArgs(args, model);
    },
  );

  registerDbHook('rules:upsert', models, HookTiming.before, [DbAction.upsert], async (options) => {
    const { model, args, previous } = options as HookOptions & { action: SingleAction };
    processCreateArgs(args, model);
    if (previous) {
      processUpdateArgs(args, model, previous);
    }
  });

  registerDbHook('rules:update', models, HookTiming.before, [DbAction.update], async (options) => {
    const { model, args, previous } = options as HookOptions & { action: SingleAction };
    processUpdateArgs(args, model, previous);
  });

  registerDbHook(
    'rules:updateManyAndReturn',
    models,
    HookTiming.after,
    [DbAction.updateManyAndReturn],
    async ({ model, result }) => {
      const rule = ruleForModel(model);
      if (rule === true) return;

      for (const record of result as Record<string, unknown>[]) {
        validateRules(record, model);
      }
    },
  );
};
