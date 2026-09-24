import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import type { Contact, Organization, User } from '@template/db/generated/client/client';
import { cleanupTouchedTables, createContact, createOrganizationUser, createUser } from '@template/db/test';
import { WS_CHANNELS } from '@template/shared/ws';
import { dataFrame } from '#/ws/dataFrame';
import { sendToStreamLocal } from '#/ws/delivery';
import { websocketHandler } from '#/ws/handler';
import { byStream, clearRegistry } from '#/ws/registry';
import { createTestSocket } from '#tests/createTestSocket';
import { createBearerToken } from '#tests/utils/createBearerToken';

const frames = (sent: string[]) => sent.map((message) => JSON.parse(message));

const until = async (predicate: () => boolean, attempts = 10_000): Promise<void> => {
  for (let i = 0; !predicate(); i++) {
    if (i >= attempts) throw new Error('until: predicate never held');
    await Promise.resolve();
  }
};

describe('data streams (real app)', () => {
  let member: User;
  let organization: Organization;
  let contact: Contact;
  let memberBearer: string;
  let stream: string;

  beforeAll(async () => {
    const { context } = await createOrganizationUser({ role: 'member' });
    member = context.user;
    organization = context.organization;
    ({ entity: contact } = await createContact(
      { ownerModel: 'Organization', organizationId: organization.id },
      { organization },
    ));
    memberBearer = (await createBearerToken(member)).authorization;
    stream = WS_CHANNELS.organizationReadManyContacts.name(organization.id);
  });

  afterEach(() => clearRegistry());

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  const connect = (authorization?: string) => {
    const handle = createTestSocket({ headers: authorization ? { authorization } : {} });
    websocketHandler.open(handle.socket);
    handle.sent.length = 0;
    return handle;
  };

  const openFrame = (name: string) => JSON.stringify({ action: 'open', stream: name });

  it('acknowledges an authorized open, then sends the route response as the snapshot', async () => {
    const { socket, sent } = connect(memberBearer);
    await websocketHandler.message(socket, openFrame(stream));

    const [opened, snapshot] = frames(sent);
    expect(opened).toEqual({ type: 'opened', stream });
    expect(snapshot).toMatchObject({ category: 'data', action: 'snapshot', stream });
    expect(snapshot.payload.data.map((row: { id: string }) => row.id)).toEqual([contact.id]);
    expect(snapshot.payload.pagination.total).toBe(1);
    expect([...(byStream.get(stream) ?? [])]).toEqual([socket.data.connectionId]);
  });

  it('rejects an open from a connection without a credential', async () => {
    const { socket, sent } = connect();
    await websocketHandler.message(socket, openFrame(stream));

    expect(frames(sent)).toEqual([{ type: 'openRejected', stream }]);
    expect(byStream.has(stream)).toBe(false);
    expect(socket.data.streams.size).toBe(0);
  });

  it('rejects an open by a user the route forbids', async () => {
    const { entity: outsider } = await createUser();
    const { socket, sent } = connect((await createBearerToken(outsider)).authorization);
    await websocketHandler.message(socket, openFrame(stream));

    expect(frames(sent)).toEqual([{ type: 'openRejected', stream }]);
    expect(byStream.has(stream)).toBe(false);
  });

  it('rejects non-canonical names: trailing segments, duplicate keys', async () => {
    const { socket, sent } = connect(memberBearer);
    const junk = [`${stream}:junk`, `organizationReadManyContacts:id:nope:id:${organization.id}`];
    for (const name of junk) await websocketHandler.message(socket, openFrame(name));

    expect(frames(sent)).toEqual(junk.map((name) => ({ type: 'openRejected', stream: name })));
    expect(byStream.size).toBe(0);
  });

  it('an open dequeued after the socket closed leaves nothing indexed', async () => {
    const { socket } = connect(memberBearer);
    const first = websocketHandler.message(socket, openFrame(stream));
    const second = websocketHandler.message(socket, openFrame('organizationReadManyContacts:id:x'));
    websocketHandler.close(socket);
    await Promise.all([first, second]);

    expect(byStream.size).toBe(0);
    expect(socket.data.streams.size).toBe(0);
  });

  it('rejects names outside the stream registry, including query channels', async () => {
    const { socket, sent } = connect(memberBearer);
    const queryChannel = WS_CHANNELS.inquiryRead.name(contact.id);
    await websocketHandler.message(socket, openFrame('nope:id:x'));
    await websocketHandler.message(socket, openFrame(queryChannel));
    await websocketHandler.message(socket, openFrame('organizationReadManyContacts'));

    expect(frames(sent)).toEqual([
      { type: 'openRejected', stream: 'nope:id:x' },
      { type: 'openRejected', stream: queryChannel },
      { type: 'openRejected', stream: 'organizationReadManyContacts' },
    ]);
    expect(byStream.size).toBe(0);
  });

  it('holds appends published while the snapshot is in flight and sends them after it', async () => {
    const { socket, sent } = connect(memberBearer);
    const pending = websocketHandler.message(socket, openFrame(stream));
    await until(() => byStream.has(stream));

    sendToStreamLocal(stream, dataFrame('append', stream, { remove: 'in-flight' }));
    expect(sent).toEqual([]);
    await pending;

    expect(frames(sent).map((frame) => frame.type ?? frame.action)).toEqual(['opened', 'snapshot', 'append']);
    expect(frames(sent)[2]).toEqual(dataFrame('append', stream, { remove: 'in-flight' }));
  });

  it('delivers appends directly once the stream is open', async () => {
    const { socket, sent } = connect(memberBearer);
    await websocketHandler.message(socket, openFrame(stream));
    sent.length = 0;

    sendToStreamLocal(stream, dataFrame('append', stream, { remove: 'x' }));

    expect(frames(sent)).toEqual([dataFrame('append', stream, { remove: 'x' })]);
  });

  it('close stops delivery and confirms', async () => {
    const { socket, sent } = connect(memberBearer);
    await websocketHandler.message(socket, openFrame(stream));
    await websocketHandler.message(socket, JSON.stringify({ action: 'close', stream }));

    expect(frames(sent).at(-1)).toEqual({ type: 'closed', stream });
    expect(byStream.has(stream)).toBe(false);
    expect(socket.data.streams.has(stream)).toBe(false);
  });

  it('closing the socket closes every stream on it', async () => {
    const { socket } = connect(memberBearer);
    await websocketHandler.message(socket, openFrame(stream));
    websocketHandler.close(socket);

    expect(byStream.has(stream)).toBe(false);
  });

  it('an identity change closes open streams so they must be re-authorized', async () => {
    const { socket } = connect(memberBearer);
    socket.data.userId = member.id;
    await websocketHandler.message(socket, openFrame(stream));
    await websocketHandler.message(socket, JSON.stringify({ action: 'logout' }));

    expect(byStream.has(stream)).toBe(false);
    expect(socket.data.streams.size).toBe(0);
  });

  it('an open resolving after the socket closed neither indexes nor sends', async () => {
    const { socket, sent } = connect(memberBearer);
    const pending = websocketHandler.message(socket, openFrame(stream));
    await until(() => byStream.has(stream));
    websocketHandler.close(socket);
    await pending;

    expect(byStream.has(stream)).toBe(false);
    expect(sent).toEqual([]);
  });
});
