import { log, LogScope } from '@template/shared/logger';

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

export type SingleAction = DbAction.create | DbAction.update | DbAction.delete | DbAction.upsert;
export type ManyAction = DbAction.createManyAndReturn | DbAction.updateManyAndReturn | DbAction.deleteMany;

type HookOptionsBase = {
  model: string;
  operation: string;
  args: unknown;
};

type SingleHookOptions = HookOptionsBase & {
  action: SingleAction;
  result?: Record<string, unknown>;
  previous?: Record<string, unknown>;
};

type ManyHookOptions = HookOptionsBase & {
  action: ManyAction;
  result?: Record<string, unknown>[];
  previous?: Record<string, unknown>[];
};

export type HookOptions = SingleHookOptions | ManyHookOptions;

export type HookFunction = (options: HookOptions) => Promise<void>;

const registeredHooks: {
  [model: string]: {
    [timing in HookTiming]: {
      [action in DbAction]?: HookFunction[];
    };
  };
} = {};

const hookRegistry = new Set<string>();

export const registerDbHook = (
  name: string,
  model: string | '*',
  timing: HookTiming,
  actions: DbAction[],
  hook: HookFunction,
) => {
  if (hookRegistry.has(name)) {
    log.warn(`Hook '${name}' already registered - skipping duplicate`, LogScope.hook);
    return;
  }

  if (!actions.length) {
    throw new Error('Hook registration requires at least one action');
  }

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

export const clearHookRegistry = () => {
  hookRegistry.clear();
  for (const model of Object.keys(registeredHooks)) {
    delete registeredHooks[model];
  }
};
