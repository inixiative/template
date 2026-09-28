import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import type { Organization, User } from '@template/db/generated/client/client';
import { buildContact, cleanupTouchedTables, createContact, createOrganizationUser } from '@template/db/test';
import { defineStream, STREAM_DEFINITIONS, type StreamDefinition } from '@template/shared/ws';
import { z } from 'zod';
import { emitAppEvent } from '#/appEvents/emit';
import {
  organizationContactRemove,
  organizationContactUpsert,
} from '#/appEvents/handlers/contact/organizationContactsStream';
import { routeRow } from '#/appEvents/routeRow';
import { streamAppend } from '#/appEvents/streamAppend';
import { organizationReadManyContactsRoute } from '#/modules/organization/routes/organizationReadManyContacts';
import { websocketHandler } from '#/ws/handler';
import { initWebSocketPubSub } from '#/ws/pubsub';
import { clearRegistry } from '#/ws/registry';
import { createTestSocket } from '#tests/createTestSocket';
import { createBearerToken } from '#tests/utils/createBearerToken';

const organizationContactsStream = STREAM_DEFINITIONS.organizationReadManyContacts;

const waitFor = async (predicate: () => boolean, timeoutMs = 3000): Promise<void> => {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

describe('organization contacts stream producers', () => {
  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('targets the owning organization stream with an upsert of the row the route serves', async () => {
    const { context } = await createOrganizationUser({ role: 'member' });
    const { entity: contact } = await createContact(
      { ownerModel: 'Organization', organizationId: context.organization.id },
      { organization: context.organization },
    );

    const [handoff] = organizationContactUpsert(contact) ?? [];

    expect(handoff).toEqual<object>({
      kind: 'stream',
      target: { stream: organizationContactsStream.name({ id: context.organization.id }) },
      append: { type: 'upsert', payload: routeRow(organizationReadManyContactsRoute, contact) },
    });
  });

  it('removes by id', async () => {
    const { entity: contact } = await buildContact({ ownerModel: 'Organization', organizationId: 'org-1' });

    const [handoff] = organizationContactRemove(contact) ?? [];

    expect(handoff).toEqual<object>({
      kind: 'stream',
      target: { stream: organizationContactsStream.name({ id: 'org-1' }) },
      append: { type: 'remove', payload: { id: contact.id } },
    });
  });

  it('produces nothing for a contact no organization owns', async () => {
    const { entity: contact } = await buildContact({ ownerModel: 'User', userId: 'user-1' });
    expect(organizationContactUpsert(contact)).toBeNull();
    expect(organizationContactRemove(contact)).toBeNull();
  });

  it('carries a revive flag on the append only when asked', async () => {
    const { context } = await createOrganizationUser({ role: 'member' });
    const { entity: contact } = await createContact(
      { ownerModel: 'Organization', organizationId: context.organization.id },
      { organization: context.organization },
    );
    const row = routeRow(organizationReadManyContactsRoute, contact);

    const plain = streamAppend(organizationContactsStream, { id: 'org-1' }, 'upsert', row);
    const revived = streamAppend(organizationContactsStream, { id: 'org-1' }, 'upsert', row, { revive: true });

    expect(plain.append).toStrictEqual<object>({ type: 'upsert', payload: row });
    expect(revived.append).toStrictEqual<object>({ type: 'upsert', payload: row, revive: true });
  });

  it('refuses a perRecipient append that names no recipients', () => {
    const perRecipient = defineStream('meReadManyContacts', {
      kind: 'list',
      audience: 'perRecipient',
      params: z.object({}),
    }) as StreamDefinition;

    // @ts-expect-error a perRecipient stream requires userIds
    expect(() => streamAppend(perRecipient, {}, 'remove', { id: 'c1' })).toThrow('requires userIds');
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
    const stream = organizationContactsStream.name({ id: organization.id });
    const handle = createTestSocket({ headers: { authorization: (await createBearerToken(member)).authorization } });
    websocketHandler.open(handle.socket);
    await websocketHandler.message(handle.socket, JSON.stringify({ action: 'open', stream }));
    const snapshot = handle.sent.map((message) => JSON.parse(message)).find((frame) => frame.action === 'snapshot');
    handle.sent.length = 0;
    return { ...handle, stream, snapshotRows: snapshot.payload.data as Array<{ id: string }> };
  };

  const appends = (sent: string[]) =>
    sent.map((message) => JSON.parse(message)).filter((frame) => frame.action === 'append');

  it('pushes contact changes as appends whose rows match what the route snapshot serves', async () => {
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
      { category: 'data', action: 'append', stream, type: 'upsert', payload: routeRow },
      { category: 'data', action: 'append', stream, type: 'remove', payload: { id: contact.id } },
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

    expect(appends(sent)[0]).toMatchObject({ stream, type: 'upsert', payload: { id: contact.id } });
  });

  it('does not push a contact owned elsewhere', async () => {
    const { sent } = await openStream();
    const { entity: contact } = await createContact({ ownerModel: 'User' }, { user: member });

    await emitAppEvent('contact.created', { contact });
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(appends(sent)).toEqual([]);
  });
});
