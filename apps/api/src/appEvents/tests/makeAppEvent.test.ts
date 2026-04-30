import { describe, expect, it, mock } from 'bun:test';
import { makeAppEvent } from '#/appEvents/makeAppEvent';
import type { AppEventPayload } from '#/appEvents/types';

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
  it('returns a handler function', () => {
    const handler = makeAppEvent({});
    expect(typeof handler).toBe('function');
  });

  describe('observe', () => {
    it('calls observe callback with event data', async () => {
      const observeFn = mock(() => ({ observed: true }));
      const handler = makeAppEvent({ observe: observeFn });

      await handler(createEvent('test', { foo: 'bar' }));

      expect(observeFn).toHaveBeenCalledWith({ foo: 'bar' });
    });

    it('skips observe when callback returns null', async () => {
      const handler = makeAppEvent({ observe: () => null });
      await handler(createEvent('test', {}));
    });
  });

  describe('email', () => {
    it('calls email callback with event data', async () => {
      const emailFn = mock(() => [{ to: [{ userIds: ['user-1'] }], template: 'test', data: {} }]);

      const handler = makeAppEvent({ email: emailFn });
      await handler(createEvent('test', { key: 'val' }));

      expect(emailFn).toHaveBeenCalledWith({ key: 'val' });
    });

    it('skips when callback returns null', async () => {
      const handler = makeAppEvent({ email: () => null });
      await handler(createEvent('test', {}));
    });

    it('skips when callback returns empty array', async () => {
      const handler = makeAppEvent({ email: () => [] });
      await handler(createEvent('test', {}));
    });
  });

  describe('websocket', () => {
    it('calls websocket callback with event data', async () => {
      const wsFn = mock(() => [{ target: { userIds: ['user-1'] }, message: { data: { test: true } } }]);

      const handler = makeAppEvent({ websocket: wsFn });
      await handler(createEvent('test', { key: 'val' }));

      expect(wsFn).toHaveBeenCalledWith({ key: 'val' });
    });

    it('skips when callback returns null', async () => {
      const handler = makeAppEvent({ websocket: () => null });
      await handler(createEvent('test', {}));
    });
  });

  describe('cb', () => {
    it('calls all callbacks with event data', async () => {
      const cb1 = mock(async () => {});
      const cb2 = mock(async () => {});

      const handler = makeAppEvent({ cb: [cb1, cb2] });
      await handler(createEvent('test', { x: 1 }));

      expect(cb1).toHaveBeenCalledWith({ x: 1 });
      expect(cb2).toHaveBeenCalledWith({ x: 1 });
    });
  });

  describe('bridge isolation', () => {
    it('one bridge failing does not prevent others from running, but still rejects', async () => {
      const cbSuccess = mock(async () => {});

      const handler = makeAppEvent({
        observe: () => {
          throw new Error('observe boom');
        },
        cb: [cbSuccess],
      });

      await expect(handler(createEvent('test', {}))).rejects.toThrow('observe boom');

      expect(cbSuccess).toHaveBeenCalled();
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
      const handler = makeAppEvent({});
      await handler(createEvent('test', {}));
    });
  });
});
