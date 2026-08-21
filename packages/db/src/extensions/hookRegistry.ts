/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */

import { LogScope, log } from '@template/shared/logger';
import { castArray } from 'lodash-es';

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

// T is the model's record shape. Defaults to Record<string, unknown> for
// hooks that don't care about the specific model type. Use a narrower type
// when registering model-specific hooks to avoid manual casting inside the hook.
type SingleHookOptions<T = Record<string, unknown>> = HookOptionsBase & {
  action: SingleAction;
  result?: T;
  previous?: T;
};

type ManyHookOptions<T = Record<string, unknown>> = HookOptionsBase & {
  action: ManyAction;
  result?: T[];
  previous?: T[];
};

export type HookOptions<T = Record<string, unknown>> = SingleHookOptions<T> | ManyHookOptions<T>;

export type HookFunction<T = Record<string, unknown>> = (options: HookOptions<T>) => Promise<void>;

const registeredHooks: {
  [model: string]: {
    [timing in HookTiming]: {
      [action in DbAction]?: HookFunction[];
    };
  };
} = {};

const hookRegistry = new Set<string>();

const hookRegistrations = new Map<
  string,
  { targets: string[]; timing: HookTiming; actions: DbAction[]; hook: HookFunction }
>();

export const registerDbHook = <T = Record<string, unknown>>(
  name: string,
  model: string | string[] | '*',
  timing: HookTiming,
  actions: DbAction[],
  hook: HookFunction<T>,
) => {
  if (hookRegistry.has(name)) {
    log.warn(`Hook '${name}' already registered - skipping duplicate`, LogScope.hook);
    return;
  }

  if (!actions.length) {
    throw new Error('Hook registration requires at least one action');
  }

  hookRegistry.add(name);
  hookRegistrations.set(name, { targets: castArray(model), timing, actions, hook: hook as HookFunction });

  for (const target of castArray(model)) {
    registeredHooks[target] ??= {
      [HookTiming.before]: {},
      [HookTiming.after]: {},
    };

    for (const action of actions) {
      registeredHooks[target][timing][action] ??= [];
      registeredHooks[target][timing][action]!.push(hook as HookFunction);
    }
  }
};

export const unregisterDbHook = (name: string) => {
  const registration = hookRegistrations.get(name);
  if (!registration) return;

  for (const target of registration.targets) {
    const timingHooks = registeredHooks[target]?.[registration.timing];
    if (!timingHooks) continue;

    for (const action of registration.actions) {
      const hooks = timingHooks[action];
      if (hooks) timingHooks[action] = hooks.filter((hook) => hook !== registration.hook);
    }
  }

  hookRegistry.delete(name);
  hookRegistrations.delete(name);
};

// Order is implicit: model hooks before global ('*'), each in registration order — so a hook that
// must run AFTER another (e.g. emailVersioning augments the snapshot auditLog writes, so it must
// follow auditLog) relies on registration order, which per-model re-registration can silently break.
// TODO (not urgent, mechanism TBD): a way for a hook to require running after another, with a cycle
// check over the declared orderings.
export const executeHooks = async (timing: HookTiming, options: HookOptions) => {
  const modelHooks = registeredHooks[options.model]?.[timing]?.[options.action] || [];
  const globalHooks = registeredHooks['*']?.[timing]?.[options.action] || [];

  for (const hook of [...modelHooks, ...globalHooks]) {
    await hook(options);
  }
};

export const clearHookRegistry = () => {
  hookRegistry.clear();
  hookRegistrations.clear();
  for (const model of Object.keys(registeredHooks)) {
    delete registeredHooks[model];
  }
};
