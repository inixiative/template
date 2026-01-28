import { lowerFirst } from 'lodash-es';
import { Prisma } from '@template/db/generated/client/client';
import { db } from '@template/db/client';

export enum DbAction {
  create = 'create',
  createManyAndReturn = 'createManyAndReturn',
  update = 'update',
  updateManyAndReturn = 'updateManyAndReturn',
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
  previous?: Record<string, unknown>;
  requestId?: string | null;
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
    // deleteMany is the only "many" operation that doesn't return records
    // createManyAndReturn and updateManyAndReturn return records, so after hooks work
    if (actions.includes(DbAction.deleteMany)) {
      throw new Error(
        'After hooks are not supported for deleteMany (only returns count). Use Before hooks instead.',
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

  if (!actions.length) {
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

const enrichHookOptions = (options: HookOptions): HookOptions => ({
  ...options,
  requestId: db.getScopeId(),
});

const fetchExistingRecord = async (
  model: Prisma.ModelName,
  where: Record<string, unknown>,
): Promise<Record<string, unknown> | null> => {
  const accessor = lowerFirst(model) as keyof typeof db.raw;
  const delegate = db.raw[accessor] as { findUnique: Function };
  return delegate.findUnique({ where });
};

export const mutationLifeCycleExtension = () =>
  Prisma.defineExtension({
    name: 'mutationLifeCycle',
    query: {
      $allModels: {
        async create({ model, operation, args, query }) {
          const hookOptions = enrichHookOptions({ model, operation, action: DbAction.create, args });
          await executeHooks(HookTiming.before, hookOptions);
          const result = await query(args);
          hookOptions.result = result;
          await executeHooks(HookTiming.after, hookOptions);
          return result;
        },

        async createMany({ model }) {
          throw new Error(
            `createMany is not supported - use createManyAndReturn instead for ${model}. ` +
              'This ensures hooks (webhooks, cache, validation) work correctly.',
          );
        },

        async createManyAndReturn({ model, operation, args, query }) {
          const hookOptions = enrichHookOptions({ model, operation, action: DbAction.createManyAndReturn, args });
          await executeHooks(HookTiming.before, hookOptions);
          const result = await query(args);
          hookOptions.result = result;
          await executeHooks(HookTiming.after, hookOptions);
          return result;
        },

        async update({ model, operation, args, query }) {
          const { where } = args as { where: Record<string, unknown> };
          const previous = (await fetchExistingRecord(model, where)) ?? undefined;
          const hookOptions = enrichHookOptions({ model, operation, action: DbAction.update, args, previous });
          await executeHooks(HookTiming.before, hookOptions);
          const result = await query(args);
          hookOptions.result = result;
          await executeHooks(HookTiming.after, hookOptions);
          return result;
        },

        async updateMany({ model }) {
          throw new Error(
            `updateMany is not supported - use updateManyAndReturn instead for ${model}. ` +
              'This ensures hooks (webhooks, cache, validation) work correctly.',
          );
        },

        async updateManyAndReturn({ model, operation, args, query }) {
          const hookOptions = enrichHookOptions({ model, operation, action: DbAction.updateManyAndReturn, args });

          // Wrap in transaction so after-hook validation failures can rollback
          return db.txn(async () => {
            await executeHooks(HookTiming.before, hookOptions);
            const result = await query(args);
            hookOptions.result = result;
            await executeHooks(HookTiming.after, hookOptions);
            return result;
          });
        },

        async upsert({ model, operation, args, query }) {
          const { where } = args as { where: Record<string, unknown> };
          const previous = (await fetchExistingRecord(model, where)) ?? undefined;
          const hookOptions = enrichHookOptions({ model, operation, action: DbAction.upsert, args, previous });
          await executeHooks(HookTiming.before, hookOptions);
          const result = await query(args);
          hookOptions.result = result;
          await executeHooks(HookTiming.after, hookOptions);
          return result;
        },

        async delete({ model, operation, args, query }) {
          const { where } = args as { where: Record<string, unknown> };
          const previous = (await fetchExistingRecord(model, where)) ?? undefined;
          const hookOptions = enrichHookOptions({ model, operation, action: DbAction.delete, args, previous });
          await executeHooks(HookTiming.before, hookOptions);
          const result = await query(args);
          hookOptions.result = result;
          await executeHooks(HookTiming.after, hookOptions);
          return result;
        },

        async deleteMany({ model, operation, args, query }) {
          const hookOptions = enrichHookOptions({ model, operation, action: DbAction.deleteMany, args });
          await executeHooks(HookTiming.before, hookOptions);
          return query(args);
        },
      },
    },
  });
