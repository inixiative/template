import { DbAction, HookTiming, registerDbHook, getModelRelations, type ModelName } from '@template/db';
import { check } from '@inixiative/json-rules';
import { isEmpty } from 'lodash-es';
import { log } from '#/lib/logger';
import { getRule } from './registry';
import { shadowMerge } from './shadowMerge';

const validateData = (data: Record<string, unknown>, model: ModelName): void => {
  const result = check(getRule(model), data);
  if (result !== true) throw new Error(typeof result === 'string' ? result : `Validation failed on ${model}`);
};

const processCreateArgs = (args: unknown, model: ModelName): void => {
  if (!args || typeof args !== 'object') return;
  if (Array.isArray(args)) return args.forEach((item) => processCreateArgs(item, model));

  const record = args as Record<string, unknown>;

  // Validate data at this level
  if (record.data && typeof record.data === 'object') {
    if (Array.isArray(record.data)) {
      record.data.forEach((d) => validateData(d as Record<string, unknown>, model));
    } else {
      validateData(record.data as Record<string, unknown>, model);
    }
  }

  // Validate create path in upsert
  if (record.create && typeof record.create === 'object' && !Array.isArray(record.create)) {
    validateData(record.create as Record<string, unknown>, model);
  }

  // Validate raw data (nested create items passed directly without wrapper)
  if (!record.data && !record.create && !record.where) {
    validateData(record, model);
  }

  // Recurse into nested relations
  const relations = getModelRelations(model);
  const dataRecord = (record.data as Record<string, unknown>) ?? {};
  const createRecord = (record.create as Record<string, unknown>) ?? {};

  for (const rel of relations) {
    const targetModel = rel.targetModel as ModelName;
    const nested = dataRecord[rel.relationName] ?? createRecord[rel.relationName] ?? record[rel.relationName];
    if (!nested || typeof nested !== 'object') continue;

    const nestedRecord = nested as Record<string, unknown>;
    for (const op of ['create', 'createMany', 'upsert'] as const) {
      if (nestedRecord[op]) processCreateArgs(nestedRecord[op], targetModel);
    }
  }
};

const processUpdateArgs = (args: unknown, model: ModelName, previous?: Record<string, unknown>): void => {
  if (!args || typeof args !== 'object') return;
  if (Array.isArray(args)) return args.forEach((item) => processUpdateArgs(item, model));

  const record = args as Record<string, unknown>;
  const data = record.data as Record<string, unknown> | undefined;

  // Merge previous with update data and validate
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const merged = shadowMerge(previous, data);
    validateData(merged, model);
  }

  // For upsert, also validate the update path
  if (record.update && typeof record.update === 'object' && !Array.isArray(record.update)) {
    const merged = shadowMerge(previous, record.update as Record<string, unknown>);
    validateData(merged, model);
  }

  // Warn if nested updates detected - can't merge without fetching previous for each nested record
  const relations = getModelRelations(model);
  const dataRecord = data ?? {};
  const updateRecord = (record.update as Record<string, unknown>) ?? {};

  for (const rel of relations) {
    const nested = dataRecord[rel.relationName] ?? updateRecord[rel.relationName];
    if (!nested || typeof nested !== 'object') continue;

    const nestedRecord = nested as Record<string, unknown>;
    const upsertUpdate = (nestedRecord.upsert as Record<string, unknown>)?.update;
    const hasUpdate = nestedRecord.update || nestedRecord.updateMany || (nestedRecord.upsert && !isEmpty(upsertUpdate));

    if (hasUpdate) {
      log.warn(`Nested update on ${model}.${rel.relationName} skips rule validation - use explicit transaction`);
    }
  }
};

export function registerRulesHook() {
  // Create hooks
  registerDbHook(
    'rules:create',
    '*',
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn],
    async ({ model, args }) => processCreateArgs(args, model as ModelName),
  );

  // Upsert hook - validate create path always, update path only if record exists
  registerDbHook(
    'rules:upsert',
    '*',
    HookTiming.before,
    [DbAction.upsert],
    async ({ model, args, previous }) => {
      processCreateArgs(args, model as ModelName);
      // Only validate update path if previous record exists (otherwise it's a create)
      if (previous) {
        processUpdateArgs(args, model as ModelName, previous);
      }
    },
  );

  // Update hooks
  registerDbHook(
    'rules:update',
    '*',
    HookTiming.before,
    [DbAction.update],
    async ({ model, args, previous }) => processUpdateArgs(args, model as ModelName, previous),
  );

  // UpdateManyAndReturn - validate results (runs in transaction for rollback on failure)
  registerDbHook(
    'rules:updateManyAndReturn',
    '*',
    HookTiming.after,
    [DbAction.updateManyAndReturn],
    async ({ model, result }) => {
      const rule = getRule(model as ModelName);
      if (rule === true) return;

      for (const record of result as Record<string, unknown>[]) {
        validateData(record, model as ModelName);
      }
    },
  );
}
