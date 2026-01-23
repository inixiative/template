import { Prisma } from '../generated/client/client';

export enum DbAction {
  create = 'create',
  createMany = 'createMany',
  update = 'update',
  updateMany = 'updateMany',
  delete = 'delete',
  deleteMany = 'deleteMany',
  upsert = 'upsert',
}

export enum HookTiming {
  before = 'before',
  after = 'after',
}

export type HookOptions = {
  model: Prisma.ModelName | '*';
  operation: string;
  action: DbAction;
  args: unknown;
  result?: unknown;
};

export type HookFunction = (options: HookOptions) => Promise<void>;

const registeredHooks: {
  [model: string]: {
    [timing in HookTiming]: {
      [action in DbAction]?: HookFunction[];
    };
  };
} = {};

const hookRegistry = new Set<string>();

const validateHookRegistration = (timing: HookTiming, actions: DbAction[]) => {
  if (timing === HookTiming.after) {
    const manyOperations = [DbAction.createMany, DbAction.updateMany, DbAction.deleteMany];
    const invalidActions = actions.filter((action) => manyOperations.includes(action));

    if (invalidActions.length > 0) {
      throw new Error(
        `After hooks are not supported for Many operations (${invalidActions.join(', ')}). ` +
          'Many operations only return counts, not the actual records. Use Before hooks instead.',
      );
    }
  }
};

export const registerDbHook = (
  name: string,
  model: string | '*',
  timing: HookTiming,
  actions: DbAction[],
  hook: HookFunction,
) => {
  if (hookRegistry.has(name)) {
    console.warn(`Hook '${name}' already registered - skipping duplicate`);
    return;
  }

  if (actions.length === 0) {
    throw new Error('Hook registration requires at least one action');
  }
  validateHookRegistration(timing, actions);

  hookRegistry.add(name);

  registeredHooks[model] ??= {
    [HookTiming.before]: {},
    [HookTiming.after]: {},
  };

  for (const action of actions) {
    registeredHooks[model][timing][action] ??= [];
    registeredHooks[model][timing][action]!.push(hook);
  }
};

export const executeHooks = async (timing: HookTiming, options: HookOptions) => {
  const modelHooks = registeredHooks[options.model]?.[timing]?.[options.action] || [];
  const globalHooks = registeredHooks['*']?.[timing]?.[options.action] || [];

  for (const hook of [...modelHooks, ...globalHooks]) {
    await hook(options);
  }
};

const logMutation = (hookOptions: HookOptions, enableLogging: boolean) => {
  if (!enableLogging) return;

  console.log(
    JSON.stringify(
      {
        level: 'info',
        msg: 'Prisma mutation',
        mutation: {
          model: hookOptions.model,
          operation: hookOptions.operation,
          action: hookOptions.action,
          args: hookOptions.args,
        },
      },
      (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
    ),
  );
};

type MutationLifeCycleOptions = {
  enableLogging?: boolean;
};

export const mutationLifeCycleExtension = (options?: MutationLifeCycleOptions) => {
  const { enableLogging = false } = options || {};

  return Prisma.defineExtension({
    name: 'mutationLifeCycle',
    query: {
      $allModels: {
        async create({ model, operation, args, query }) {
          const hookOptions: HookOptions = { model, operation, action: DbAction.create, args };
          logMutation(hookOptions, enableLogging);
          await executeHooks(HookTiming.before, hookOptions);
          const result = await query(args);
          hookOptions.result = result;
          await executeHooks(HookTiming.after, hookOptions);
          return result;
        },

        async createMany({ model, operation, args, query }) {
          const hookOptions: HookOptions = { model, operation, action: DbAction.createMany, args };
          logMutation(hookOptions, enableLogging);
          await executeHooks(HookTiming.before, hookOptions);
          const result = await query(args);
          return result;
        },

        async update({ model, operation, args, query }) {
          const hookOptions: HookOptions = { model, operation, action: DbAction.update, args };
          logMutation(hookOptions, enableLogging);
          await executeHooks(HookTiming.before, hookOptions);
          const result = await query(args);
          hookOptions.result = result;
          await executeHooks(HookTiming.after, hookOptions);
          return result;
        },

        async updateMany({ model, operation, args, query }) {
          const hookOptions: HookOptions = { model, operation, action: DbAction.updateMany, args };
          logMutation(hookOptions, enableLogging);
          await executeHooks(HookTiming.before, hookOptions);
          const result = await query(args);
          return result;
        },

        async upsert({ model, operation, args, query }) {
          const hookOptions: HookOptions = { model, operation, action: DbAction.upsert, args };
          logMutation(hookOptions, enableLogging);
          await executeHooks(HookTiming.before, hookOptions);
          const result = await query(args);
          hookOptions.result = result;
          await executeHooks(HookTiming.after, hookOptions);
          return result;
        },

        async delete({ model, operation, args, query }) {
          const hookOptions: HookOptions = { model, operation, action: DbAction.delete, args };
          logMutation(hookOptions, enableLogging);
          await executeHooks(HookTiming.before, hookOptions);
          const result = await query(args);
          hookOptions.result = result;
          await executeHooks(HookTiming.after, hookOptions);
          return result;
        },

        async deleteMany({ model, operation, args, query }) {
          const hookOptions: HookOptions = { model, operation, action: DbAction.deleteMany, args };
          logMutation(hookOptions, enableLogging);
          await executeHooks(HookTiming.before, hookOptions);
          const result = await query(args);
          return result;
        },
      },
    },
  });
};
