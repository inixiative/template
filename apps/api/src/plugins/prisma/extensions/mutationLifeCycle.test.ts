import { describe, it, expect } from 'bun:test';
import { registerDbHook, DbAction, HookTiming, executeHooks } from './mutationLifeCycle';

describe('mutationLifeCycle', () => {

  it('should register and execute hooks', async () => {
    let hookCalled = false;
    const testHook = async () => {
      hookCalled = true;
    };

    registerDbHook('User', HookTiming.after, [DbAction.create], testHook);

    await executeHooks({} as any, HookTiming.after, {
      model: 'User',
      action: DbAction.create,
      args: {},
      result: { id: '123' }
    });

    expect(hookCalled).toBe(true);
  });

  it('should execute global hooks for any model', async () => {
    let globalHookCalled = false;
    const globalHook = async () => {
      globalHookCalled = true;
    };

    registerDbHook('*', HookTiming.after, [DbAction.create], globalHook);

    await executeHooks({} as any, HookTiming.after, {
      model: 'Post',
      action: DbAction.create,
      args: {},
      result: { id: '456' }
    });

    expect(globalHookCalled).toBe(true);
  });

  it('should execute both model-specific and global hooks', async () => {
    let modelHookCalled = false;
    let globalHookCalled = false;

    registerDbHook('User', HookTiming.after, [DbAction.create], async () => {
      modelHookCalled = true;
    });

    registerDbHook('*', HookTiming.after, [DbAction.create], async () => {
      globalHookCalled = true;
    });

    await executeHooks({} as any, HookTiming.after, {
      model: 'User',
      action: DbAction.create,
      args: {},
      result: { id: '789' }
    });

    expect(modelHookCalled).toBe(true);
    expect(globalHookCalled).toBe(true);
  });
});