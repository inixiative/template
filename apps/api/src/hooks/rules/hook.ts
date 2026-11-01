import { type Condition, check } from '@inixiative/json-rules';
import {
  DbAction,
  type HookOptions,
  HookTiming,
  isCleared,
  isPrismaNull,
  type ModelName,
  materializedColumns,
  materializedIdConflicts,
  registerDbHook,
  type SingleAction,
  withDiscriminatorDefaults,
  withMaterializedIds,
} from '@template/db';
import { castArray, without } from 'lodash-es';
import { getRule, RulesRegistry } from '#/hooks/rules/registry';
import { shadowMerge } from '#/hooks/rules/shadowMerge';
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
    getRule(model),
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

const tombstoneFields = new Set(['deletedAt', 'updatedAt']);

export const writtenDeletedAt = (data: Record<string, unknown>): unknown =>
  shadowMerge(undefined, { deletedAt: data.deletedAt }).deletedAt;

const isTombstone = (data: Record<string, unknown>): boolean =>
  !isCleared(writtenDeletedAt(data)) &&
  Object.keys(data).every((field) => tombstoneFields.has(field));

const processCreateArgs = (args: unknown, model: ModelName): void => {
  const data = (args as Record<string, unknown>)?.data ?? (args as Record<string, unknown>)?.create;
  if (!data || typeof data !== 'object') return;
  for (const row of castArray(data) as Record<string, unknown>[]) {
    const defaulted = withDiscriminatorDefaults(model, row);
    validateRules(defaulted, model);
    const [conflict] = materializedIdConflicts(model, defaulted);
    if (conflict) throw makeError({ status: 422, message: conflict });
    const materialized = withMaterializedIds(model, defaulted);
    for (const column of materializedColumns(model))
      if (materialized[column] != null) row[column] = materialized[column];
  }
};

const processUpdateArgs = (
  args: unknown,
  model: ModelName,
  previous?: Record<string, unknown>,
): void => {
  const data = ((args as Record<string, unknown>)?.data ??
    (args as Record<string, unknown>)?.update) as Record<string, unknown> | undefined;
  if (data && typeof data === 'object' && !Array.isArray(data) && !isTombstone(data))
    validateRules(shadowMerge(previous, data), model);
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
    async ({ model, args, result }) => {
      const rule = getRule(model);
      if (rule === true) return;
      const data = (args as { data?: Record<string, unknown> })?.data;
      if (data && isTombstone(data)) return;

      for (const record of result as Record<string, unknown>[]) {
        validateRules(record, model);
      }
    },
  );
};
