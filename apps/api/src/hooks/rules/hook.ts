import { check } from '@inixiative/json-rules';
import {
  DbAction,
  type HookOptions,
  HookTiming,
  type ModelName,
  registerDbHook,
  type SingleAction,
} from '@template/db';
import { without } from 'lodash-es';
import { getRule, RulesRegistry } from '#/hooks/rules/registry';
import { shadowMerge } from '#/hooks/rules/shadowMerge';
import { makeError } from '#/lib/errors';

const validateData = (data: Record<string, unknown>, model: ModelName): void => {
  const result = check(getRule(model), data);
  if (result !== true)
    throw makeError({ status: 422, message: typeof result === 'string' ? result : `Validation failed on ${model}` });
};

const processCreateArgs = (args: unknown, model: ModelName): void => {
  const data = (args as Record<string, unknown>)?.data ?? (args as Record<string, unknown>)?.create;
  if (!data || typeof data !== 'object') return;
  if (Array.isArray(data)) for (const d of data) validateData(d as Record<string, unknown>, model);
  else validateData(data as Record<string, unknown>, model);
};

const processUpdateArgs = (args: unknown, model: ModelName, previous?: Record<string, unknown>): void => {
  const data = ((args as Record<string, unknown>)?.data ?? (args as Record<string, unknown>)?.update) as
    | Record<string, unknown>
    | undefined;
  if (data && typeof data === 'object' && !Array.isArray(data)) validateData(shadowMerge(previous, data), model);
};

export const registerRulesHook = () => {
  const models = without(Object.keys(RulesRegistry), 'AuditLog');

  registerDbHook(
    'rules:create',
    models,
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn],
    async ({ model, args }) => {
      processCreateArgs(args, model as ModelName);
    },
  );

  registerDbHook('rules:upsert', models, HookTiming.before, [DbAction.upsert], async (options) => {
    const { model, args, previous } = options as HookOptions & { action: SingleAction };
    processCreateArgs(args, model as ModelName);
    if (previous) {
      processUpdateArgs(args, model as ModelName, previous);
    }
  });

  registerDbHook('rules:update', models, HookTiming.before, [DbAction.update], async (options) => {
    const { model, args, previous } = options as HookOptions & { action: SingleAction };
    processUpdateArgs(args, model as ModelName, previous);
  });

  registerDbHook(
    'rules:updateManyAndReturn',
    models,
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
};
