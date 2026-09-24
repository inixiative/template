import { afterAll, afterEach, beforeAll, describe, expect, it, spyOn } from 'bun:test';
import { createHash, randomBytes } from 'node:crypto';
import { db, unregisterDbHook } from '@template/db';
import type { Contact, Organization, User } from '@template/db/generated/client/client';
import { PlatformRole, TokenOwnerModel } from '@template/db/generated/client/enums';
import { organizationContactsStream } from '@template/db/streams';
import {
  cleanupTouchedTables,
  createContact,
  createOrganizationUser,
  createToken,
  createUser,
} from '@template/db/test';
import { WS_CHANNELS, WS_MAX_PENDING_FRAMES } from '@template/shared/ws';
import { app } from '#/app';
import { registerClearCacheHook } from '#/hooks/cache/hook';
import { streamAppendFrame } from '#/ws/dataFrame';
import { sendToStreamLocal } from '#/ws/delivery';
import { websocketHandler } from '#/ws/handler';
import { byStream, clearRegistry } from '#/ws/registry';
import { reauthorizeOpenStreams } from '#/ws/streamReauthorizeSweep';
import { createTestSocket } from '#tests/createTestSocket';
import { createBearerToken } from '#tests/utils/createBearerToken';

const frames = (sent: string[]) => sent.map((message) => JSON.parse(message));

const until = async (predicate: () => boolean, attempts = 10_000): Promise<void> => {
  for (let i = 0; !predicate(); i++) {
    if (i >= attempts) throw new Error('until: predicate never held');
    await Promise.resolve();
  }
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

const withStreamRouteStatus = async <T>(status: number, run: () => Promise<T>): Promise<T> => {
  const realRequest = app.request.bind(app);
  const spy = spyOn(app, 'request').mockImplementation(((input: string, init?: RequestInit) =>
    String(input).endsWith('/contacts')
      ? Promise.resolve(new Response('unavailable', { status }))
      : realRequest(input, init)) as never);
  try {
    return await run();
  } finally {
    spy.mockRestore();
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
    stream = organizationContactsStream.name({ id: organization.id });
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
    expect(organizationContactsStream.snapshot.safeParse(snapshot.payload).success).toBe(true);
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

  it('answers a 5xx or 429 snapshot with a retryable error, not a rejection', async () => {
    for (const status of [500, 503, 429]) {
      const { socket, sent } = connect(memberBearer);
      await withStreamRouteStatus(status, () => websocketHandler.message(socket, openFrame(stream)));

      expect(frames(sent)).toEqual([{ type: 'error', action: 'open', stream, retryable: true }]);
      expect(byStream.has(stream)).toBe(false);
      clearRegistry();
    }
  });

  it('rejects non-canonical names: trailing segments, duplicate keys', async () => {
    const { socket, sent } = connect(memberBearer);
    const junk = [`${stream}:junk`, `organizationReadManyContacts:id:nope:id:${organization.id}`];
    for (const name of junk) await websocketHandler.message(socket, openFrame(name));

    expect(frames(sent)).toEqual(junk.map((name) => ({ type: 'openRejected', stream: name })));
    expect(byStream.size).toBe(0);
  });

  it('rejects dot-segment params that would resolve to a different route', async () => {
    const { socket, sent } = connect(memberBearer);
    const dotted = ['organizationReadManyContacts:id:..', 'organizationReadManyContacts:id:.'];
    for (const name of dotted) await websocketHandler.message(socket, openFrame(name));

    expect(frames(sent)).toEqual(dotted.map((name) => ({ type: 'openRejected', stream: name })));
    expect(byStream.size).toBe(0);
  });

  it('answers every open past the pending-frame cap with a retryable error', async () => {
    const { entity: flooder } = await createUser();
    const { socket, sent } = connect((await createBearerToken(flooder)).authorization);
    const names = Array.from({ length: WS_MAX_PENDING_FRAMES + 8 }, () =>
      organizationContactsStream.name({ id: crypto.randomUUID() }),
    );
    await Promise.all(names.map((name) => websocketHandler.message(socket, openFrame(name))));

    const answered = frames(sent);
    expect(answered).toHaveLength(names.length);
    expect(new Set(answered.map((frame) => frame.stream))).toEqual(new Set(names));
    for (const name of names.slice(WS_MAX_PENDING_FRAMES)) {
      expect(answered).toContainEqual({ type: 'error', action: 'open', stream: name, retryable: true });
    }
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

    const append = streamAppendFrame(stream, 'remove', { id: 'in-flight', updatedAt: new Date().toISOString() });
    sendToStreamLocal(stream, append);
    expect(sent).toEqual([]);
    await pending;

    expect(frames(sent).map((frame) => (frame.type === 'opened' ? 'opened' : frame.action))).toEqual([
      'opened',
      'snapshot',
      'append',
    ]);
    expect(frames(sent)[2]).toEqual(append);
  });

  it('delivers appends directly once the stream is open', async () => {
    const { socket, sent } = connect(memberBearer);
    await websocketHandler.message(socket, openFrame(stream));
    sent.length = 0;

    const append = streamAppendFrame(stream, 'remove', { id: 'x', updatedAt: new Date().toISOString() });
    sendToStreamLocal(stream, append);

    expect(frames(sent)).toEqual([append]);
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

  it('switching the same user to a narrower credential closes streams it cannot read', async () => {
    const { context: other } = await createOrganizationUser({ role: 'member' }, { user: member });
    const rawKey = randomBytes(24).toString('hex');
    await createToken(
      {
        keyHash: createHash('sha256').update(rawKey).digest('hex'),
        keyPrefix: rawKey.slice(0, 16),
        ownerModel: TokenOwnerModel.OrganizationUser,
      },
      { organizationUser: other.organizationUser },
    );
    const { socket, sent } = connect();
    const authenticate = (authorization: string) =>
      websocketHandler.message(socket, JSON.stringify({ action: 'authenticate', headers: { authorization } }));

    await authenticate(memberBearer);
    await websocketHandler.message(socket, openFrame(stream));
    expect(byStream.has(stream)).toBe(true);

    await authenticate(`Bearer ${rawKey}`);
    expect(socket.data.userId).toBe(member.id);
    expect(byStream.has(stream)).toBe(false);

    sent.length = 0;
    await websocketHandler.message(socket, openFrame(stream));
    expect(frames(sent)).toEqual([{ type: 'openRejected', stream }]);
  });

  it('re-sending the same credential keeps open streams', async () => {
    const { socket } = connect();
    const authenticate = () =>
      websocketHandler.message(
        socket,
        JSON.stringify({ action: 'authenticate', headers: { authorization: memberBearer } }),
      );
    await authenticate();
    await websocketHandler.message(socket, openFrame(stream));
    await authenticate();

    expect(byStream.has(stream)).toBe(true);
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

  describe('re-authorization of open streams', () => {
    it('keeps a stream the credential can still read', async () => {
      const { socket, sent } = connect(memberBearer);
      await websocketHandler.message(socket, openFrame(stream));
      sent.length = 0;

      await reauthorizeOpenStreams();

      expect(sent).toEqual([]);
      expect(byStream.has(stream)).toBe(true);
    });

    it('closes a stream whose route now answers 403, and stops its appends', async () => {
      const { context } = await createOrganizationUser({ role: 'member' }, { organization });
      const revocable = connect((await createBearerToken(context.user)).authorization);
      const staying = connect(memberBearer);
      await websocketHandler.message(revocable.socket, openFrame(stream));
      await websocketHandler.message(staying.socket, openFrame(stream));
      revocable.sent.length = 0;
      staying.sent.length = 0;

      registerClearCacheHook();
      try {
        await db.txn(() => db.organizationUser.delete({ where: { id: context.organizationUser.id } }));
        await settle();
      } finally {
        unregisterDbHook('clearCache');
      }
      await reauthorizeOpenStreams();
      sendToStreamLocal(stream, streamAppendFrame(stream, 'remove', { id: 'x', updatedAt: new Date().toISOString() }));

      expect(frames(revocable.sent)).toEqual([{ type: 'openRejected', stream }]);
      expect(revocable.socket.data.streams.has(stream)).toBe(false);
      expect(frames(staying.sent).map((frame) => frame.action)).toEqual(['append']);
    });

    it('closes a stream with a retryable error when the recheck hits a 5xx', async () => {
      const { socket, sent } = connect(memberBearer);
      await websocketHandler.message(socket, openFrame(stream));
      sent.length = 0;

      await withStreamRouteStatus(503, () => reauthorizeOpenStreams());

      expect(frames(sent)).toEqual([{ type: 'error', action: 'open', stream, retryable: true }]);
      expect(byStream.has(stream)).toBe(false);
    });

    it('does not pile up a second recheck while one is still queued', async () => {
      const { socket } = connect(memberBearer);
      await websocketHandler.message(socket, openFrame(stream));
      const probe = spyOn(app, 'request');
      try {
        await Promise.all([reauthorizeOpenStreams(), reauthorizeOpenStreams()]);
        expect(probe.mock.calls.filter(([input]) => String(input).endsWith('/contacts'))).toHaveLength(1);
      } finally {
        probe.mockRestore();
      }
    });
  });
  describe('adversarial review', () => {
    const withMeStatus = async <T>(status: number, run: () => Promise<T>): Promise<T> => {
      const realRequest = app.request.bind(app);
      const spy = spyOn(app, 'request').mockImplementation(((input: string, init?: RequestInit) =>
        String(input).endsWith('/api/v1/me')
          ? Promise.resolve(new Response('busy', { status }))
          : realRequest(input, init)) as never);
      try {
        return await run();
      } finally {
        spy.mockRestore();
      }
    };

    it('a transient /me failure keeps the identity and its streams and answers a retryable error', async () => {
      const { entity: user } = await createUser();
      await createOrganizationUser({ role: 'member' }, { organization, user });
      const { authorization } = await createBearerToken(user);
      const { socket, sent } = connect();
      const authenticate = () =>
        websocketHandler.message(socket, JSON.stringify({ action: 'authenticate', headers: { authorization } }));
      await authenticate();
      await websocketHandler.message(socket, openFrame(stream));
      sent.length = 0;

      await withMeStatus(429, authenticate);

      expect(frames(sent)).toEqual([{ type: 'error', action: 'authenticate', retryable: true }]);
      expect(socket.data.userId).toBe(user.id);
      expect(byStream.has(stream)).toBe(true);
    });

    it('a transient /me failure during a spoof is not a spoof rejection', async () => {
      const { entity: admin } = await createUser({ platformRole: PlatformRole.superadmin });
      const { authorization } = await createBearerToken(admin);
      const { socket, sent } = connect();
      await withMeStatus(503, () =>
        websocketHandler.message(
          socket,
          JSON.stringify({ action: 'authenticate', headers: { authorization, 'x-spoof-user-email': member.email } }),
        ),
      );
      expect(frames(sent)).toEqual([{ type: 'error', action: 'authenticate', retryable: true }]);
    });

    it('closes a spoofed connection’s streams once the spoof no longer resolves to the spoofed user', async () => {
      const { entity: admin } = await createUser({ platformRole: PlatformRole.superadmin });
      await createOrganizationUser({ role: 'member' }, { organization, user: admin });
      const { authorization } = await createBearerToken(admin);
      const { socket, sent } = connect();
      await websocketHandler.message(
        socket,
        JSON.stringify({ action: 'authenticate', headers: { authorization, 'x-spoof-user-email': member.email } }),
      );
      expect(socket.data.userId).toBe(member.id);
      await websocketHandler.message(socket, openFrame(stream));
      sent.length = 0;

      registerClearCacheHook();
      try {
        await db.txn(() => db.user.update({ where: { id: admin.id }, data: { platformRole: PlatformRole.user } }));
        await settle();
      } finally {
        unregisterDbHook('clearCache');
      }
      await reauthorizeOpenStreams();

      expect(frames(sent)).toEqual([{ type: 'openRejected', stream }]);
      expect(byStream.has(stream)).toBe(false);
    });

    it('a probe that throws closes that stream as retryable and still rechecks the rest', async () => {
      const { entity: user } = await createUser();
      const { context: other } = await createOrganizationUser({ role: 'member' }, { user });
      await createOrganizationUser({ role: 'member' }, { organization, user });
      const otherStream = organizationContactsStream.name({ id: other.organization.id });
      const { socket, sent } = connect((await createBearerToken(user)).authorization);
      await websocketHandler.message(socket, openFrame(otherStream));
      await websocketHandler.message(socket, openFrame(stream));
      sent.length = 0;

      const spy = spyOn(app, 'request').mockImplementation(((input: string) =>
        String(input).includes(other.organization.id)
          ? Promise.reject(new Error('boom'))
          : Promise.resolve(new Response(null, { status: 403 }))) as never);
      try {
        await reauthorizeOpenStreams();
      } finally {
        spy.mockRestore();
      }

      expect(frames(sent)).toEqual([
        { type: 'error', action: 'open', stream: otherStream, retryable: true },
        { type: 'openRejected', stream },
      ]);
    });
  });
});
