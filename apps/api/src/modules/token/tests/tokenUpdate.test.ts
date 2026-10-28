import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import type {
  Organization,
  OrganizationUser,
  Role,
  User,
} from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
} from '@template/db/test';
import { tokenRouter } from '#/modules/token';
import { createTestApp } from '#tests/createTestApp';
import { createKeyedToken } from '#tests/utils/createKeyedToken';
import { createTokenProbeApp } from '#tests/utils/createTokenProbeApp';
import { patch } from '#tests/utils/request';

let organization: Organization;

beforeAll(async () => {
  ({ entity: organization } = await createOrganization());
});

afterAll(async () => {
  await cleanupTouchedTables(db);
});

const seatOf = async (role: Role) => {
  const { entity: seat, context } = await createOrganizationUser({ role }, { organization });
  return { seat, user: context.user };
};

const tokenOf = async (seat: OrganizationUser, data: { role: Role | null; full?: boolean }) =>
  createKeyedToken({ ownerModel: 'OrganizationUser', ...data }, { organizationUser: seat });

const as = (user: User, seat: OrganizationUser) =>
  createTestApp({
    mockUser: user,
    mockOrganizationUsers: [seat],
    mount: [(hono) => hono.route('/api/v1/token', tokenRouter)],
  });

const update = (app: ReturnType<typeof as>, id: string, body: Record<string, unknown>) =>
  app.fetch(patch(`/api/v1/token/${id}`, body));

describe('PATCH /token/:id — a token is full or narrowed, and either can change', () => {
  it('its user changes the role, and names it', async () => {
    const { seat, user } = await seatOf('admin');
    const { entity: token } = await tokenOf(seat, { role: 'admin' });
    expect(
      (await update(as(user, seat), token.id, { role: 'viewer', name: 'reader' })).status,
    ).toBe(200);
    expect(await db.token.findUniqueOrThrow({ where: { id: token.id } })).toMatchObject({
      role: 'viewer',
      name: 'reader',
    });
  });

  it('the role is capped by what the member holds: an admin cannot raise it to owner', async () => {
    const { seat, user } = await seatOf('admin');
    const { entity: token } = await tokenOf(seat, { role: 'viewer' });
    expect((await update(as(user, seat), token.id, { role: 'owner' })).status).toBe(403);
  });

  it('a viewer cannot raise its token above viewer', async () => {
    const { seat, user } = await seatOf('viewer');
    const { entity: token } = await tokenOf(seat, { role: 'viewer' });
    expect((await update(as(user, seat), token.id, { role: 'member' })).status).toBe(403);
  });

  it('another user cannot change my token', async () => {
    const { seat } = await seatOf('owner');
    const { entity: token } = await tokenOf(seat, { role: 'viewer' });
    const other = await seatOf('owner');
    expect((await update(as(other.user, other.seat), token.id, { role: 'admin' })).status).toBe(
      403,
    );
  });

  it('a token cannot change itself', async () => {
    const { seat } = await seatOf('owner');
    const { entity: token, rawKey } = await tokenOf(seat, { role: 'admin' });
    const { call } = createTokenProbeApp((hono) => hono.route('/api/v1/token', tokenRouter));
    expect(
      (await call(rawKey, 'PATCH', `/api/v1/token/${token.id}`, { role: 'owner' })).status,
    ).toBe(403);
  });

  it('its user narrows a full token, then makes it full again', async () => {
    const { seat, user } = await seatOf('owner');
    const { entity: token } = await tokenOf(seat, { role: null, full: true });
    const app = as(user, seat);
    expect((await update(app, token.id, { full: false, role: 'viewer' })).status).toBe(200);
    expect((await update(app, token.id, { full: true, role: null })).status).toBe(200);
  });
});
