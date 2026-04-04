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
    const handler = makeAppEvent({ observe: () => ({ test: true }) });
    expect(typeof handler).toBe('function');
  });

  it('calls observe callback with event data', async () => {
    const observeFn = mock(() => ({ observed: true }));
    const handler = makeAppEvent({ observe: observeFn });

    await handler(createEvent('test.event', { foo: 'bar' }));

    expect(observeFn).toHaveBeenCalledWith({ foo: 'bar' });
  });

  it('calls email callback and passes handoffs to bridge', async () => {
    const emailFn = mock(() => [
      {
        to: [{ userIds: ['user-1'] }],
        template: 'test-template',
        data: { key: 'value' },
      },
    ]);

    const handler = makeAppEvent({ email: emailFn });

    await handler(createEvent('test.event', { foo: 'bar' }));

    expect(emailFn).toHaveBeenCalledWith({ foo: 'bar' });
  });

  it('calls websocket callback', async () => {
    const wsFn = mock(() => [
      {
        target: { userIds: ['user-1'] },
        message: { data: { event: 'test' } },
      },
    ]);

    const handler = makeAppEvent({ websocket: wsFn });

    await handler(createEvent('test.event', { foo: 'bar' }));

    expect(wsFn).toHaveBeenCalledWith({ foo: 'bar' });
  });

  it('calls cb callbacks', async () => {
    const cb1 = mock(async () => {});
    const cb2 = mock(async () => {});

    const handler = makeAppEvent({ cb: [cb1, cb2] });

    await handler(createEvent('test.event', { foo: 'bar' }));

    expect(cb1).toHaveBeenCalledWith({ foo: 'bar' });
    expect(cb2).toHaveBeenCalledWith({ foo: 'bar' });
  });

  it('skips email bridge when callback returns null', async () => {
    const emailFn = mock(() => null);
    const handler = makeAppEvent({ email: emailFn });

    await handler(createEvent('test.event', {}));

    expect(emailFn).toHaveBeenCalled();
  });

  it('skips email bridge when callback returns empty array', async () => {
    const emailFn = mock(() => []);
    const handler = makeAppEvent({ email: emailFn });

    await handler(createEvent('test.event', {}));

    expect(emailFn).toHaveBeenCalled();
  });

  it('skips observe when callback returns null', async () => {
    const observeFn = mock(() => null);
    const handler = makeAppEvent({ observe: observeFn });

    await handler(createEvent('test.event', {}));

    expect(observeFn).toHaveBeenCalled();
  });
});
