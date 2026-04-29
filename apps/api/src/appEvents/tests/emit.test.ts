import { afterEach, describe, expect, it, mock } from 'bun:test';
import { db } from '@template/db';
import { AppEventName, appEventHandlers } from '#/appEvents/handlers';
import { emitAppEvent } from '#/appEvents/emit';
import { auditActorContext } from '#/lib/auditActorContext';

describe('emitAppEvent', () => {
  const originalHandlers = { ...appEventHandlers };

  afterEach(() => {
    for (const [name, handler] of Object.entries(originalHandlers)) {
      appEventHandlers[name as keyof typeof appEventHandlers] = handler;
    }
  });

  it('dispatches to the correct handler by name', async () => {
    const mockHandler = mock(async () => {});
    appEventHandlers[AppEventName.userCreated] = mockHandler;

    await emitAppEvent('user.created', { userId: 'test-id', isGuest: false });

    expect(mockHandler).toHaveBeenCalledTimes(1);
    const event = mockHandler.mock.calls[0][0];
    expect(event.name).toBe('user.created');
    expect(event.data).toEqual({ userId: 'test-id', isGuest: false });
  });

  it('auto-enriches actor from auditActorContext', async () => {
    const mockHandler = mock(async () => {});
    appEventHandlers[AppEventName.userCreated] = mockHandler;

    await auditActorContext.scope(
      {
        actorUserId: 'actor-123',
        actorSpoofUserId: null,
        actorTokenId: 'token-456',
        actorJobName: null,
        ipAddress: '10.0.0.1',
        userAgent: 'TestAgent/1.0',
        sourceInquiryId: null,
      },
      () => emitAppEvent('user.created', { userId: 'test-id', isGuest: true }),
    );

    const event = mockHandler.mock.calls[0][0];
    expect(event.actor.actorUserId).toBe('actor-123');
    expect(event.actor.actorTokenId).toBe('token-456');
    expect(event.actor.ipAddress).toBe('10.0.0.1');
    expect(event.actor.userAgent).toBe('TestAgent/1.0');
  });

  it('uses nullAuditActor when no context scope', async () => {
    const mockHandler = mock(async () => {});
    appEventHandlers[AppEventName.userCreated] = mockHandler;

    await emitAppEvent('user.created', { userId: 'test-id', isGuest: false });

    const event = mockHandler.mock.calls[0][0];
    expect(event.actor.actorUserId).toBeNull();
    expect(event.actor.ipAddress).toBeNull();
  });

  it('includes resourceType and resourceId from options', async () => {
    const mockHandler = mock(async () => {});
    appEventHandlers[AppEventName.userCreated] = mockHandler;

    await emitAppEvent('user.created', { userId: 'test-id', isGuest: false }, {
      resourceType: 'User',
      resourceId: 'test-id',
    });

    const event = mockHandler.mock.calls[0][0];
    expect(event.resourceType).toBe('User');
    expect(event.resourceId).toBe('test-id');
  });

  it('sets timestamp', async () => {
    const mockHandler = mock(async () => {});
    appEventHandlers[AppEventName.userCreated] = mockHandler;

    const before = new Date().toISOString();
    await emitAppEvent('user.created', { userId: 'test-id', isGuest: false });
    const after = new Date().toISOString();

    const event = mockHandler.mock.calls[0][0];
    expect(event.timestamp >= before).toBe(true);
    expect(event.timestamp <= after).toBe(true);
  });

  it('does nothing for unknown event names', async () => {
    await emitAppEvent('nonexistent.event' as never, {} as never);
  });

  it('rejects after commit when a deferred handler fails', async () => {
    const mockHandler = mock(async () => {
      throw new Error('deferred handler boom');
    });
    appEventHandlers[AppEventName.userCreated] = mockHandler;

    await expect(
      db.txn(async () => {
        await emitAppEvent('user.created', { userId: 'test-id', isGuest: false });
      }),
    ).rejects.toThrow('deferred handler boom');

    expect(mockHandler).toHaveBeenCalledTimes(1);
  });
});
