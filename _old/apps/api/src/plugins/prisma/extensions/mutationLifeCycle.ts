import { Prisma } from '@prisma/client';
import type { ElysiaApp } from 'src/app/types';

export const DbAction = Object.freeze({
  'create': 'create',
  'update': 'update',
  'delete': 'delete',
  'upsert': 'upsert',
} as const)
export type DbActionType = typeof DbAction[keyof typeof DbAction];

export const HookTiming = Object.freeze({
  'before': 'before',
  'after': 'after',
} as const)

export type HookTimingType = typeof HookTiming[keyof typeof HookTiming];

export type HookOptions = {
  model: string;
  action: DbActionType;
  args: any;
  previous?: any;
  result?: any;
};

export type HookFunction = (app: ElysiaApp, options: HookOptions) => Promise<void>;

const registeredHooks: {
  [model: string]: {
    [timing in HookTimingType]: {
      [action in DbActionType]: HookFunction[];
    };
  };
} = {};

export const registerDbHook = (model: string | '*', timing: HookTimingType, actions: DbActionType[], hook: HookFunction) => {
  registeredHooks[model] ??= {
    before: { create: [], update: [], upsert: [], delete: [] },
    after: { create: [], update: [], upsert: [], delete: [] },
  };
  for (const action of actions) {
    registeredHooks[model][timing][action].push(hook);
  }
};

export const executeHooks = async (app: ElysiaApp, timing: HookTimingType, options: HookOptions) => {
  const modelHooks = registeredHooks[options.model]?.[timing][options.action] || [];
  const globalHooks = registeredHooks['*']?.[timing][options.action] || [];

  for (const hook of [...modelHooks, ...globalHooks]) {
    await hook(app, options);
  }
};

export const mutationLifeCycleExtension = (app: ElysiaApp) => ({
  query: {
    $allModels: {
      async create({ model, args, query }) {
        const action = DbAction.create;
        await executeHooks(app, HookTiming.before, { model, action, args });
        const result = await query(args);
        await executeHooks(app, HookTiming.after, { model, action, args, result });
        return result;
      },
      async update({ model, args, query }) {
        const action = DbAction.update;
        const previous = await app.db[model].findUnique({ where: args.where });
        await executeHooks(app, HookTiming.before, { model, action, args, previous });
        const result = await query(args);
        await executeHooks(app, HookTiming.after, { model, action, args, previous, result });
        return result;
      },
      async upsert({ model, args, query }) {
        const action = DbAction.upsert;
        const previous = await app.db[model].findUnique({ where: args.where });
        await executeHooks(app, HookTiming.before, { model, action, args, previous });
        const result = await query(args);
        await executeHooks(app, HookTiming.after, { model, action, args, previous, result });
        return result;
      },
      async delete({ model, args, query }) {
        const action = DbAction.delete;
        const previous = await app.db[model].findUnique({ where: args.where });
        await executeHooks(app, HookTiming.before, { model, action, args, previous });
        const result = await query(args);
        await executeHooks(app, HookTiming.after, { model, action, args, previous, result });
        return result;
      },
    },
  },
});
