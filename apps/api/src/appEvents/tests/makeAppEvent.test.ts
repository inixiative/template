import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { makeAppEvent } from '#/appEvents/makeAppEvent';
import type { AppEventPayload, ObserveData } from '#/appEvents/types';
import { observeRegistry } from '#/lib/observe';

const createEvent = (name: string, data: Record<string, unknown>): AppEventPayload => ({
  name,
  actor: {
    actorUserId: 'user-1',
    actorSpoofUserId: null,
    actorTokenId: null,
    actorJobName: null,
    ipAddress: '127.0.0.1',
    userAgent: 'test',
    sourceInquiryId: null,
  },
  data,
  timestamp: new Date().toISOString(),
});

describe('makeAppEvent', () => {
  // A real recording observe adapter — lets us assert that makeAppEvent dispatches
  // selector output through the real registry (broadcast → adapter.record), rather
  // than spying on the selector. Registered alongside the default 'db' adapter.
  const observed: Array<{ event: AppEventPayload; data: ObserveData }> = [];
  beforeAll(() => {
    observeRegistry.register('test-recorder', {
      record: async (event, data) => {
        observed.push({ event, data });
      },
    });
  });
  afterAll(() => observeRegistry.unregister('test-recorder'));
  afterEach(() => {
    observed.length = 0;
  });

  it('returns a handler function', () => {
    expect(typeof makeAppEvent({})).toBe('function');
  });

  describe('observe', () => {
    it('dispatches the selector output through the observe registry', async () => {
      const handler = makeAppEvent<{ foo: string }>({ observe: (data) => ({ tag: data.foo }) });

      await handler(createEvent('test', { foo: 'bar' }));

      expect(observed).toHaveLength(1);
      expect(observed[0].data).toEqual({ tag: 'bar' });
      expect(observed[0].event.name).toBe('test');
    });

    it('skips dispatch when the selector returns null', async () => {
      const handler = makeAppEvent({ observe: () => null });

      await handler(createEvent('test', {}));

      expect(observed).toHaveLength(0);
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

  describe('bridge isolation', () => {
    it('one bridge failing does not prevent others from running, but still rejects', async () => {
      let cbRan = false;
      const handler = makeAppEvent({
        observe: () => {
          throw new Error('observe boom');
        },
        cb: [
          async () => {
            cbRan = true;
          },
        ],
      });

      await expect(handler(createEvent('test', {}))).rejects.toThrow('observe boom');
      expect(cbRan).toBe(true);
    });

    it('waits for sibling bridges before rejecting', async () => {
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
    it('completes without error when no bridges defined', async () => {
      await makeAppEvent({})(createEvent('test', {}));
    });
  });
});
