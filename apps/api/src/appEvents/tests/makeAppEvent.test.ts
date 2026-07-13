import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { makeAppEvent } from '#/appEvents/makeAppEvent';
import type { AppEventPayload } from '#/appEvents/types';
import { observeRegistry } from '#/lib/observe';

const createEvent = (name: string, data: Record<string, unknown>): AppEventPayload => ({
  id: Bun.randomUUIDv7(),
  name,
  actor: {
    actorUserId: 'user-1',
    actorSpoofUserId: null,
    actorTokenId: null,
    actorJobName: null,
    ipAddress: '127.0.0.1',
    userAgent: 'test',
    sourceInquiryId: null,
    integrationId: null,
  },
  data,
});

describe('makeAppEvent', () => {
  const observed: AppEventPayload[] = [];
  beforeAll(() => {
    observeRegistry.register('test-recorder', {
      record: async (event) => {
        observed.push(event);
      },
    });
  });
  afterAll(() => observeRegistry.unregister('test-recorder'));
  afterEach(async () => {
    observed.length = 0;
    await db.appEvent.deleteMany({ where: { name: 'test' } });
  });

  it('returns a handler function', () => {
    expect(typeof makeAppEvent({})).toBe('function');
  });

  describe('observe', () => {
    it('broadcasts the full envelope for every handled event', async () => {
      const handler = makeAppEvent<{ foo: string }>({});

      await handler(createEvent('test', { foo: 'bar' }));

      expect(observed).toHaveLength(1);
      expect(observed[0].name).toBe('test');
      expect(observed[0].data).toEqual({ foo: 'bar' });
      expect(observed[0].actor.actorUserId).toBe('user-1');
    });

    it('broadcasts alongside other channels', async () => {
      const handler = makeAppEvent<{ foo: string }>({
        email: () => [{ template: 'test', data: {} }],
      });

      await handler(createEvent('test', { foo: 'bar' }));

      expect(observed).toHaveLength(1);
    });

    it('upserts the AppEvent row keyed by the envelope id', async () => {
      const event = createEvent('test', { foo: 'db' });

      await makeAppEvent({})(event);
      await makeAppEvent({})(event);

      const rows = await db.appEvent.findMany({ where: { name: 'test' } });
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(event.id);
      expect(rows[0].data).toEqual({ foo: 'db' });
      expect(rows[0].actorUserId).toBe('user-1');
    });
  });

  describe('email', () => {
    it('invokes the email selector with the event data', async () => {
      let received: unknown;
      const handler = makeAppEvent({
        email: (data) => {
          received = data;
          return [{ template: 'test', data: {} }];
        },
      });

      await handler(createEvent('test', { key: 'val' }));

      expect(received).toEqual({ key: 'val' });
    });

    it('skips when the selector returns null', async () => {
      let calls = 0;
      const handler = makeAppEvent({
        email: () => {
          calls += 1;
          return null;
        },
      });

      await handler(createEvent('test', {}));

      expect(calls).toBe(1);
    });
  });

  describe('websocket', () => {
    it('invokes the websocket selector with the event data', async () => {
      let received: unknown;
      const handler = makeAppEvent({
        websocket: (data) => {
          received = data;
          return [{ target: { userIds: ['user-1'] }, message: { data: { test: true } } }];
        },
      });

      await handler(createEvent('test', { key: 'val' }));

      expect(received).toEqual({ key: 'val' });
    });
  });

  describe('cb', () => {
    it('calls all callbacks with the event data', async () => {
      const seen: unknown[] = [];
      const handler = makeAppEvent({
        cb: [async (data) => void seen.push(data), async (data) => void seen.push(data)],
      });

      await handler(createEvent('test', { x: 1 }));

      expect(seen).toEqual([{ x: 1 }, { x: 1 }]);
    });
  });

  describe('channel isolation', () => {
    it('one channel failing does not prevent others from running, but still rejects', async () => {
      let cbRan = false;
      const handler = makeAppEvent({
        email: () => {
          throw new Error('email boom');
        },
        cb: [
          async () => {
            cbRan = true;
          },
        ],
      });

      await expect(handler(createEvent('test', {}))).rejects.toThrow('email boom');
      expect(cbRan).toBe(true);
    });

    it('waits for sibling channels before rejecting', async () => {
      const callOrder: string[] = [];
      const handler = makeAppEvent({
        cb: [
          async () => {
            throw new Error('cb boom');
          },
          async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            callOrder.push('slow sibling');
          },
        ],
      });

      await expect(handler(createEvent('test', {}))).rejects.toThrow('cb boom');
      expect(callOrder).toEqual(['slow sibling']);
    });
  });

  describe('empty handler', () => {
    it('completes without error when no channels defined', async () => {
      await makeAppEvent({})(createEvent('test', {}));
    });
  });
});
