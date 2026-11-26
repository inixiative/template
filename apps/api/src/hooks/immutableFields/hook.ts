import { DbAction, HookTiming, type ModelName, registerDbHook } from '@template/db';
import { auditActorContext } from '@template/db/lib/auditActorContext';
import { unset } from 'lodash-es';
import {
  fieldsRefusedAfterCreate,
  immutableFieldsForModel,
} from '#/hooks/immutableFields/registry';
import { makeError } from '#/lib/errors';

const fieldsTheUserMergePlanned = (obj: Record<string, unknown>, model: ModelName): Set<string> => {
  const merge = auditActorContext.currentUserMerge();
  if (!merge) return new Set();
  return new Set(
    Object.keys(obj).filter((field) => {
      const value = obj[field];
      return (
        (typeof value === 'string' || value === null) &&
        merge.plannedWrites.get(`${model}.${field}`)?.has(value)
      );
    }),
  );
};

const stripFromObject = (obj: Record<string, unknown>, model: ModelName): void => {
  const allowed = fieldsTheUserMergePlanned(obj, model);
  const [refused] = fieldsRefusedAfterCreate(model).filter(
    (field) => obj[field] !== undefined && !allowed.has(field),
  );
  if (refused)
    throw makeError({ status: 422, message: `${model}.${refused} cannot change after create` });
  for (const field of immutableFieldsForModel(model)) {
    if (!allowed.has(field)) unset(obj, field);
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
    async ({ model, args }) => processArgs(args, model),
  );
};
