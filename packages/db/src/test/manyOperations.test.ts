import { describe, it, expect, beforeEach } from 'bun:test';
import { db, DbAction, HookTiming, registerDbHook, clearHookRegistry } from '@template/db';

describe('many operations with hooks', () => {
  beforeEach(() => {
    clearHookRegistry();
  });

  describe('createManyAndReturn', () => {
    it('triggers after hooks with result[]', async () => {
      let hookResult: unknown;
      registerDbHook('test-createManyAndReturn', 'User', HookTiming.after, [DbAction.createManyAndReturn], async ({ result }) => {
        hookResult = result;
      });

      const result = await db.user.createManyAndReturn({
        data: [
          { email: `test-cmar-1-${Date.now()}@example.com` },
          { email: `test-cmar-2-${Date.now()}@example.com` },
        ],
      });

      expect(result.length).toBe(2);
      expect(Array.isArray(hookResult)).toBe(true);
      expect((hookResult as unknown[]).length).toBe(2);
    });
  });

  describe('updateManyAndReturn', () => {
    it('triggers after hooks with previous[] and result[]', async () => {
      const user = await db.user.create({ data: { email: `test-umar-${Date.now()}@example.com`, name: 'Before' } });

      let hookPrevious: unknown;
      let hookResult: unknown;
      registerDbHook('test-updateManyAndReturn', 'User', HookTiming.after, [DbAction.updateManyAndReturn], async ({ previous, result }) => {
        hookPrevious = previous;
        hookResult = result;
      });

      const result = await db.user.updateManyAndReturn({
        where: { id: user.id },
        data: { name: 'After' },
      });

      expect(result.length).toBe(1);
      expect(result[0].name).toBe('After');
      expect(Array.isArray(hookPrevious)).toBe(true);
      expect((hookPrevious as Record<string, unknown>[])[0].name).toBe('Before');
      expect(Array.isArray(hookResult)).toBe(true);
    });
  });

  describe('deleteMany', () => {
    it('triggers after hooks with previous[]', async () => {
      const user = await db.user.create({ data: { email: `test-dm-${Date.now()}@example.com` } });

      let hookPrevious: unknown;
      let hookResult: unknown;
      registerDbHook('test-deleteMany', 'User', HookTiming.after, [DbAction.deleteMany], async ({ previous, result }) => {
        hookPrevious = previous;
        hookResult = result;
      });

      const result = await db.user.deleteMany({ where: { id: user.id } });

      expect(result.count).toBe(1);
      expect(Array.isArray(hookPrevious)).toBe(true);
      expect((hookPrevious as unknown[]).length).toBe(1);
      // result is set to previous for deleteMany since Prisma only returns count
      expect(hookResult).toEqual(hookPrevious);
    });
  });
});
