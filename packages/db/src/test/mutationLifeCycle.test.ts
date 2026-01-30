import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import {
  DbAction,
  HookTiming,
  registerDbHook,
  executeHooks,
  type HookOptions,
} from '../extensions/mutationLifeCycle';

// Mock logger - the proxy makes direct spying difficult
const mockWarn = mock(() => {});
mock.module('@template/shared/logger', () => ({
  log: { warn: mockWarn, info: mock(() => {}), error: mock(() => {}), debug: mock(() => {}) },
  LogScope: { hook: 'hook', db: 'db' },
}));

describe('mutationLifeCycle', () => {
  describe('registerDbHook', () => {
    it('registers a hook for a specific model and action', async () => {
      const hookFn = mock(() => Promise.resolve());

      registerDbHook(
        'test-hook-1',
        'User',
        HookTiming.before,
        [DbAction.create],
        hookFn,
      );

      const options: HookOptions = {
        model: 'User',
        operation: 'create',
        action: DbAction.create,
        args: { data: { email: 'test@example.com' } },
      };

      await executeHooks(HookTiming.before, options);

      expect(hookFn).toHaveBeenCalledTimes(1);
      expect(hookFn).toHaveBeenCalledWith(options);
    });

    it('registers a hook for multiple actions', async () => {
      const hookFn = mock(() => Promise.resolve());

      registerDbHook(
        'test-hook-2',
        'User',
        HookTiming.before,
        [DbAction.create, DbAction.update],
        hookFn,
      );

      await executeHooks(HookTiming.before, {
        model: 'User',
        operation: 'create',
        action: DbAction.create,
        args: {},
      });

      await executeHooks(HookTiming.before, {
        model: 'User',
        operation: 'update',
        action: DbAction.update,
        args: {},
      });

      expect(hookFn).toHaveBeenCalledTimes(2);
    });

    it('registers a global hook using wildcard model', async () => {
      const hookFn = mock(() => Promise.resolve());

      registerDbHook(
        'test-hook-3',
        '*',
        HookTiming.before,
        [DbAction.create],
        hookFn,
      );

      await executeHooks(HookTiming.before, {
        model: 'User',
        operation: 'create',
        action: DbAction.create,
        args: {},
      });

      await executeHooks(HookTiming.before, {
        model: 'Session',
        operation: 'create',
        action: DbAction.create,
        args: {},
      });

      expect(hookFn).toHaveBeenCalledTimes(2);
    });

    it('skips duplicate hook registration with same name', async () => {
      const hookFn1 = mock(() => Promise.resolve());
      const hookFn2 = mock(() => Promise.resolve());
      mockWarn.mockClear();

      registerDbHook(
        'test-hook-duplicate',
        'User',
        HookTiming.before,
        [DbAction.create],
        hookFn1,
      );

      registerDbHook(
        'test-hook-duplicate',
        'User',
        HookTiming.before,
        [DbAction.create],
        hookFn2,
      );

      expect(mockWarn).toHaveBeenCalledWith(
        "Hook 'test-hook-duplicate' already registered - skipping duplicate",
        'hook',
      );

      await executeHooks(HookTiming.before, {
        model: 'User',
        operation: 'create',
        action: DbAction.create,
        args: {},
      });

      expect(hookFn1).toHaveBeenCalledTimes(1);
      expect(hookFn2).not.toHaveBeenCalled();
    });

    it('throws error when registering with empty actions array', () => {
      expect(() => {
        registerDbHook(
          'test-hook-empty',
          'User',
          HookTiming.before,
          [],
          async () => {},
        );
      }).toThrow('Hook registration requires at least one action');
    });

    it('allows after hooks on all Many operations', () => {
      expect(() => {
        registerDbHook(
          'test-hook-after-many',
          'User',
          HookTiming.after,
          [DbAction.createManyAndReturn, DbAction.updateManyAndReturn, DbAction.deleteMany],
          async () => {},
        );
      }).not.toThrow();
    });

    it('allows before hooks on all operations', () => {
      expect(() => {
        registerDbHook(
          'test-hook-before-all',
          'User',
          HookTiming.before,
          [DbAction.createManyAndReturn, DbAction.updateManyAndReturn, DbAction.deleteMany],
          async () => {},
        );
      }).not.toThrow();
    });

    it('allows after hooks on single-record operations', () => {
      expect(() => {
        registerDbHook(
          'test-hook-after-single',
          'User',
          HookTiming.after,
          [DbAction.create, DbAction.update, DbAction.delete, DbAction.upsert],
          async () => {},
        );
      }).not.toThrow();
    });
  });

  describe('executeHooks', () => {
    it('executes model-specific hooks before global hooks', async () => {
      const callOrder: string[] = [];

      registerDbHook(
        'test-hook-global-order',
        '*',
        HookTiming.before,
        [DbAction.update],
        async () => { callOrder.push('global'); },
      );

      registerDbHook(
        'test-hook-model-order',
        'User',
        HookTiming.before,
        [DbAction.update],
        async () => { callOrder.push('model'); },
      );

      await executeHooks(HookTiming.before, {
        model: 'User',
        operation: 'update',
        action: DbAction.update,
        args: {},
      });

      expect(callOrder).toEqual(['model', 'global']);
    });

    it('does not execute hooks for different models', async () => {
      const hookFn = mock(() => Promise.resolve());

      registerDbHook(
        'test-hook-different-model',
        'Session',
        HookTiming.before,
        [DbAction.create],
        hookFn,
      );

      await executeHooks(HookTiming.before, {
        model: 'User',
        operation: 'create',
        action: DbAction.create,
        args: {},
      });

      expect(hookFn).not.toHaveBeenCalled();
    });

    it('does not execute hooks for different actions', async () => {
      const hookFn = mock(() => Promise.resolve());

      registerDbHook(
        'test-hook-different-action',
        'User',
        HookTiming.before,
        [DbAction.delete],
        hookFn,
      );

      await executeHooks(HookTiming.before, {
        model: 'User',
        operation: 'create',
        action: DbAction.create,
        args: {},
      });

      expect(hookFn).not.toHaveBeenCalled();
    });

    it('does not execute hooks for different timing', async () => {
      const hookFn = mock(() => Promise.resolve());

      registerDbHook(
        'test-hook-different-timing',
        'User',
        HookTiming.after,
        [DbAction.create],
        hookFn,
      );

      await executeHooks(HookTiming.before, {
        model: 'User',
        operation: 'create',
        action: DbAction.create,
        args: {},
      });

      expect(hookFn).not.toHaveBeenCalled();
    });

    it('passes hook options including result for after hooks', async () => {
      const hookFn = mock(() => Promise.resolve());

      registerDbHook(
        'test-hook-with-result',
        'User',
        HookTiming.after,
        [DbAction.create],
        hookFn,
      );

      const options: HookOptions = {
        model: 'User',
        operation: 'create',
        action: DbAction.create,
        args: { data: { email: 'test@example.com' } },
        result: { id: 'user-123', email: 'test@example.com' },
      };

      await executeHooks(HookTiming.after, options);

      expect(hookFn).toHaveBeenCalledWith(options);
    });

    it('executes hooks sequentially', async () => {
      const callOrder: number[] = [];

      registerDbHook(
        'test-hook-sequential-1',
        'Organization',
        HookTiming.before,
        [DbAction.create],
        async () => {
          await new Promise((r) => setTimeout(r, 10));
          callOrder.push(1);
        },
      );

      registerDbHook(
        'test-hook-sequential-2',
        'Organization',
        HookTiming.before,
        [DbAction.create],
        async () => {
          callOrder.push(2);
        },
      );

      await executeHooks(HookTiming.before, {
        model: 'Organization',
        operation: 'create',
        action: DbAction.create,
        args: {},
      });

      expect(callOrder).toEqual([1, 2]);
    });

    it('handles hooks that throw errors', async () => {
      registerDbHook(
        'test-hook-error',
        'Account',
        HookTiming.before,
        [DbAction.create],
        async () => {
          throw new Error('Hook error');
        },
      );

      await expect(
        executeHooks(HookTiming.before, {
          model: 'Account',
          operation: 'create',
          action: DbAction.create,
          args: {},
        }),
      ).rejects.toThrow('Hook error');
    });

    it('handles no registered hooks gracefully', async () => {
      await expect(
        executeHooks(HookTiming.before, {
          model: 'NonExistentModel',
          operation: 'create',
          action: DbAction.create,
          args: {},
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('DbAction enum', () => {
    it('has all expected actions', () => {
      expect(DbAction.create).toBe('create');
      expect(DbAction.createManyAndReturn).toBe('createManyAndReturn');
      expect(DbAction.update).toBe('update');
      expect(DbAction.updateManyAndReturn).toBe('updateManyAndReturn');
      expect(DbAction.delete).toBe('delete');
      expect(DbAction.deleteMany).toBe('deleteMany');
      expect(DbAction.upsert).toBe('upsert');
    });
  });

  describe('HookTiming enum', () => {
    it('has before and after timings', () => {
      expect(HookTiming.before).toBe('before');
      expect(HookTiming.after).toBe('after');
    });
  });
});
