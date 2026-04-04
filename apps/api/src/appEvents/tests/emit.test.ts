import { afterEach, describe, expect, it, mock } from 'bun:test';
import { AppEventName, appEventHandlers } from '#/appEvents/handlers';

describe('emitAppEvent', () => {
  const originalHandlers = { ...appEventHandlers };

  afterEach(() => {
    for (const [name, handler] of Object.entries(originalHandlers)) {
      appEventHandlers[name as keyof typeof appEventHandlers] = handler;
    }
  });

  it('dispatches to the correct handler by name', async () => {
    const { emitAppEvent } = await import('#/appEvents/emit');

    const mockHandler = mock(async () => {});
    appEventHandlers[AppEventName.userCreated] = mockHandler;

    await emitAppEvent('user.created', { userId: 'test-id', isGuest: false });

    expect(mockHandler).toHaveBeenCalledTimes(1);
    const event = mockHandler.mock.calls[0][0];
    expect(event.name).toBe('user.created');
    expect(event.data).toEqual({ userId: 'test-id', isGuest: false });
    expect(event.actor).toBeDefined();
    expect(event.timestamp).toBeDefined();
  });

  it('auto-enriches actor from auditActorContext', async () => {
    const { emitAppEvent } = await import('#/appEvents/emit');
    const { auditActorContext } = await import('#/lib/auditActorContext');

    const mockHandler = mock(async () => {});
    appEventHandlers[AppEventName.userCreated] = mockHandler;

    await auditActorContext.scope(
      {
        actorUserId: 'actor-123',
        actorSpoofUserId: null,
        actorTokenId: null,
        actorJobName: null,
        ipAddress: '10.0.0.1',
        userAgent: 'TestAgent',
        sourceInquiryId: null,
      },
      () => emitAppEvent('user.created', { userId: 'test-id', isGuest: true }),
    );

    const event = mockHandler.mock.calls[0][0];
    expect(event.actor.actorUserId).toBe('actor-123');
    expect(event.actor.ipAddress).toBe('10.0.0.1');
    expect(event.actor.userAgent).toBe('TestAgent');
  });

  it('includes resourceType and resourceId from options', async () => {
    const { emitAppEvent } = await import('#/appEvents/emit');

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

  it('does nothing for unknown event names', async () => {
    const { emitAppEvent } = await import('#/appEvents/emit');
    await emitAppEvent('nonexistent.event' as never, {} as never);
  });
});
