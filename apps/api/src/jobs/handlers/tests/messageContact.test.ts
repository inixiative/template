import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { ContactType } from '@template/db/generated/client/enums';
import { cleanupTouchedTables, createContact, createUser } from '@template/db/test';
import { messageContact } from '#/jobs/handlers/messageContact';
import { type MessageContent, type MessageDispatchOptions, messageProviderRegistry } from '#/lib/messaging/providers';
import { createTestApp } from '#tests/createTestApp';

type DispatchedCall = {
  contactId: string;
  contactType: ContactType;
  content: MessageContent;
  options: MessageDispatchOptions;
};

describe('messageContact handler', () => {
  let testDb: ReturnType<typeof createTestApp>['db'];
  const dispatched: DispatchedCall[] = [];
  const mockLog = () => {};

  beforeAll(() => {
    const harness = createTestApp({});
    testDb = harness.db;

    // Register a real adapter for whatsapp that records every call.
    // No mocks, no fetch spy — the registry is the real wire.
    messageProviderRegistry.register(ContactType.whatsapp, async (contact, content, _kind, options) => {
      dispatched.push({ contactId: contact.id, contactType: contact.type, content, options });
    });
  });

  afterAll(async () => {
    messageProviderRegistry.unregister(ContactType.whatsapp);
    await cleanupTouchedTables(testDb);
  });

  beforeEach(() => {
    dispatched.length = 0;
  });

  afterEach(() => {
    dispatched.length = 0;
  });

  it('dispatches via the adapter when contact accepts the kind', async () => {
    const { entity: user } = await createUser();
    const { entity: contact } = await createContact(
      { ownerModel: 'User', type: ContactType.whatsapp, value: { jid: '111' }, acceptedKinds: ['platform'] },
      { user },
    );

    await messageContact(
      { db: testDb, log: mockLog },
      { contactId: contact.id, kind: 'platform', content: { text: 'hi' } },
    );

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].contactId).toBe(contact.id);
    expect(dispatched[0].content.text).toBe('hi');
  });

  it('skips silently when contact does not accept the kind', async () => {
    const { entity: user } = await createUser();
    const { entity: contact } = await createContact(
      { ownerModel: 'User', type: ContactType.whatsapp, value: { jid: '222' }, acceptedKinds: ['platform'] },
      { user },
    );

    await messageContact(
      { db: testDb, log: mockLog },
      { contactId: contact.id, kind: 'marketing', content: { text: 'promo' } },
    );

    expect(dispatched).toHaveLength(0);
  });

  it('always delivers system kind regardless of acceptedKinds', async () => {
    const { entity: user } = await createUser();
    const { entity: contact } = await createContact(
      { ownerModel: 'User', type: ContactType.whatsapp, value: { jid: '333' }, acceptedKinds: [] },
      { user },
    );

    await messageContact(
      { db: testDb, log: mockLog },
      { contactId: contact.id, kind: 'system', content: { text: 'ack' } },
    );

    expect(dispatched).toHaveLength(1);
  });

  it('passes replyTo through to the adapter', async () => {
    const { entity: user } = await createUser();
    const { entity: contact } = await createContact(
      { ownerModel: 'User', type: ContactType.whatsapp, value: { jid: '444' }, acceptedKinds: ['platform'] },
      { user },
    );

    await messageContact(
      { db: testDb, log: mockLog },
      {
        contactId: contact.id,
        kind: 'platform',
        content: { text: 'thread reply' },
        replyTo: { chatMessageId: 'msg-123' },
      },
    );

    expect(dispatched[0].options.replyTo).toEqual({ chatMessageId: 'msg-123' });
  });

  it('throws when no adapter is registered for contact.type', async () => {
    const { entity: user } = await createUser();
    const { entity: contact } = await createContact(
      { ownerModel: 'User', type: ContactType.signal, value: { handle: '+1555' }, acceptedKinds: ['platform'] },
      { user },
    );

    expect(
      messageContact(
        { db: testDb, log: mockLog },
        { contactId: contact.id, kind: 'platform', content: { text: 'hi' } },
      ),
    ).rejects.toThrow(/No message provider adapter for contact.type=signal/);
  });

  it('throws when contact does not exist', async () => {
    expect(
      messageContact(
        { db: testDb, log: mockLog },
        { contactId: '00000000-0000-0000-0000-000000000000', kind: 'platform', content: { text: 'hi' } },
      ),
    ).rejects.toThrow();
  });
});
