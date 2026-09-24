import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import type { Organization, User } from '@template/db/generated/client/client';
import { buildContact, cleanupTouchedTables, createContact, createOrganizationUser } from '@template/db/test';
import { WS_CHANNELS } from '@template/shared/ws';
import { emitAppEvent } from '#/appEvents/emit';
import { organizationContactsHandoffs } from '#/appEvents/handlers/contact/organizationContactsStream';
import { websocketHandler } from '#/ws/handler';
import { initWebSocketPubSub } from '#/ws/pubsub';
import { clearRegistry } from '#/ws/registry';
import { createTestSocket } from '#tests/createTestSocket';
import { createBearerToken } from '#tests/utils/createBearerToken';

const waitFor = async (predicate: () => boolean, timeoutMs = 3000): Promise<void> => {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

describe('organizationContactsHandoffs', () => {
  it('targets the owning organization contacts stream with the append as the message', async () => {
    const { entity: contact } = await buildContact({ ownerModel: 'Organization', organizationId: 'org-1' });
    const append = { remove: contact.id };

    expect(organizationContactsHandoffs(contact, append)).toEqual([
      { target: { streams: [WS_CHANNELS.organizationReadManyContacts.name('org-1')] }, message: { data: append } },
    ]);
  });

  it('produces nothing for a contact no organization owns', async () => {
    const { entity: contact } = await buildContact({ ownerModel: 'User', userId: 'user-1' });
    expect(organizationContactsHandoffs(contact, { remove: contact.id })).toBeNull();
  });
});

describe('organization contacts stream (app event → redis → open socket)', () => {
  let member: User;
  let organization: Organization;

  beforeAll(async () => {
    await initWebSocketPubSub();
    const { context } = await createOrganizationUser({ role: 'member' });
    member = context.user;
    organization = context.organization;
  });

  afterEach(() => clearRegistry());

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  const openStream = async () => {
    const stream = WS_CHANNELS.organizationReadManyContacts.name(organization.id);
    const handle = createTestSocket({ headers: { authorization: (await createBearerToken(member)).authorization } });
    websocketHandler.open(handle.socket);
    await websocketHandler.message(handle.socket, JSON.stringify({ action: 'open', stream }));
    const snapshot = handle.sent.map((message) => JSON.parse(message)).find((frame) => frame.action === 'snapshot');
    handle.sent.length = 0;
    return { ...handle, stream, snapshotRows: snapshot.payload.data as Array<{ id: string }> };
  };

  const appends = (sent: string[]) =>
    sent.map((message) => JSON.parse(message)).filter((frame) => frame.action === 'append');

  it('pushes contact changes as list appends whose rows match what the route snapshot serves', async () => {
    const { entity: contact } = await createContact(
      { ownerModel: 'Organization', organizationId: organization.id },
      { organization },
    );
    const { sent, stream, snapshotRows } = await openStream();
    const routeRow = snapshotRows.find((row) => row.id === contact.id);

    await emitAppEvent('contact.updated', { contact });
    await waitFor(() => appends(sent).length === 1);
    await emitAppEvent('contact.deleted', { contact });
    await waitFor(() => appends(sent).length === 2);

    expect(routeRow).toBeDefined();
    expect(appends(sent)).toEqual([
      { category: 'data', action: 'append', stream, payload: { upsert: routeRow } },
      { category: 'data', action: 'append', stream, payload: { remove: contact.id } },
    ]);
  });

  it('pushes a newly created contact to an already open stream', async () => {
    const { sent, stream } = await openStream();
    const { entity: contact } = await createContact(
      { ownerModel: 'Organization', organizationId: organization.id },
      { organization },
    );

    await emitAppEvent('contact.created', { contact });
    await waitFor(() => appends(sent).length === 1);

    expect(appends(sent)[0]).toMatchObject({ stream, payload: { upsert: { id: contact.id } } });
  });

  it('does not push a contact owned elsewhere', async () => {
    const { sent } = await openStream();
    const { entity: contact } = await createContact({ ownerModel: 'User' }, { user: member });

    await emitAppEvent('contact.created', { contact });
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(appends(sent)).toEqual([]);
  });
});
