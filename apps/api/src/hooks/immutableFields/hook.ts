import { unset } from 'lodash-es';
import { DbAction, HookTiming, registerDbHook, getModelRelations, type ModelName } from '@template/db';
import { getImmutableFields } from './registry';

const stripFromObject = (obj: Record<string, unknown>, model: ModelName): void => {
  for (const field of getImmutableFields(model)) {
    unset(obj, field);
  }
};

const processArgs = (args: unknown, model: ModelName): void => {
  if (!args || typeof args !== 'object') return;
  if (Array.isArray(args)) return args.forEach((item) => processArgs(item, model));

  const record = args as Record<string, unknown>;

  // Strip from data/update at this level (for the current model)
  if (record.data && typeof record.data === 'object' && !Array.isArray(record.data)) {
    stripFromObject(record.data as Record<string, unknown>, model);
  }
  if (record.update && typeof record.update === 'object' && !Array.isArray(record.update)) {
    stripFromObject(record.update as Record<string, unknown>, model);
  }

  // Recurse into relation fields (check both at record level and inside data)
  const relations = getModelRelations(model);
  const dataRecord = (record.data as Record<string, unknown>) ?? {};

  for (const rel of relations) {
    const targetModel = rel.targetModel as ModelName;
    const nested = dataRecord[rel.relationName] ?? record[rel.relationName];
    if (!nested || typeof nested !== 'object') continue;

    const nestedRecord = nested as Record<string, unknown>;
    for (const op of ['update', 'updateMany', 'upsert'] as const) {
      if (nestedRecord[op]) processArgs(nestedRecord[op], targetModel);
    }
  }
};

export function registerImmutableFieldsHook() {
  registerDbHook(
    'immutableFields',
    '*',
    HookTiming.before,
    [DbAction.update, DbAction.updateManyAndReturn, DbAction.upsert],
    async ({ model, args }) => processArgs(args, model as ModelName),
  );
}
