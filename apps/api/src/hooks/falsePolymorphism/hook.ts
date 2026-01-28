import { DbAction, HookTiming, registerDbHook, getModelRelations, type ModelName } from '@template/db';
import { getPolymorphismConfigs } from './registry';

const validateData = (data: Record<string, unknown>, model: ModelName): void => {
  const configs = getPolymorphismConfigs(model);
  if (!configs.length) return;

  for (const config of configs) {
    const typeValue = data[config.typeField] as string | undefined;
    if (!typeValue) continue;

    const requiredFks = config.fkMap[typeValue];
    if (!requiredFks) throw new Error(`Invalid ${config.typeField} value: ${typeValue} on ${model}`);

    const allFks = [...new Set(Object.values(config.fkMap).flat())];

    // Check for forbidden extra FKs (missing FKs are caught by Prisma FK constraints)
    for (const fk of allFks) {
      if (!requiredFks.includes(fk) && data[fk] !== undefined && data[fk] !== null) {
        throw new Error(`${model} with ${config.typeField}=${typeValue} cannot have ${fk}`);
      }
    }
  }
};

const processArgs = (args: unknown, model: ModelName, isUpdate = false): void => {
  if (!args || typeof args !== 'object') return;
  if (Array.isArray(args)) return args.forEach((item) => processArgs(item, model, isUpdate));

  const record = args as Record<string, unknown>;

  // Validate data at this level (skip for updates - immutableFields handles that)
  if (!isUpdate && record.data && typeof record.data === 'object') {
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
  if (!isUpdate && !record.data && !record.create && !record.where) {
    validateData(record, model);
  }

  // Recurse into nested relations (always check nested creates, even in updates)
  const relations = getModelRelations(model);
  const dataRecord = (record.data as Record<string, unknown>) ?? {};
  const createRecord = (record.create as Record<string, unknown>) ?? {};

  for (const rel of relations) {
    const targetModel = rel.targetModel as ModelName;
    const nested = dataRecord[rel.relationName] ?? createRecord[rel.relationName] ?? record[rel.relationName];
    if (!nested || typeof nested !== 'object') continue;

    const nestedRecord = nested as Record<string, unknown>;
    for (const op of ['create', 'createMany', 'upsert'] as const) {
      if (nestedRecord[op]) processArgs(nestedRecord[op], targetModel, false);
    }
  }
};

export function registerFalsePolymorphismHook() {
  const createActions = [DbAction.create, DbAction.createManyAndReturn, DbAction.upsert];
  const updateActions = [DbAction.update, DbAction.updateManyAndReturn];

  registerDbHook(
    'falsePolymorphism:create',
    '*',
    HookTiming.before,
    createActions,
    async ({ model, args }) => processArgs(args, model as ModelName, false),
  );

  registerDbHook(
    'falsePolymorphism:update',
    '*',
    HookTiming.before,
    updateActions,
    async ({ model, args }) => processArgs(args, model as ModelName, true),
  );
}
