import { DbAction, HookTiming, type ModelName, registerDbHook } from '@template/db';
import { unset } from 'lodash-es';
import { getImmutableFields } from '#/hooks/immutableFields/registry';

const stripFromObject = (obj: Record<string, unknown>, model: ModelName): void => {
  for (const field of getImmutableFields(model)) {
    unset(obj, field);
  }
};

const processArgs = (args: unknown, model: ModelName): void => {
  const record = args as Record<string, unknown> | null;
  if (record?.data && typeof record.data === 'object' && !Array.isArray(record.data)) {
    stripFromObject(record.data as Record<string, unknown>, model);
  }
  if (record?.update && typeof record.update === 'object' && !Array.isArray(record.update)) {
    stripFromObject(record.update as Record<string, unknown>, model);
  }
};

export const registerImmutableFieldsHook = () => {
  registerDbHook(
    'immutableFields',
    '*',
    HookTiming.before,
    [DbAction.update, DbAction.updateManyAndReturn, DbAction.upsert],
    async ({ model, args }) => processArgs(args, model as ModelName),
  );
};
