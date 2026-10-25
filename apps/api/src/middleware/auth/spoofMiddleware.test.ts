import { afterAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import type { Token, User } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createOrganizationUser,
  createToken,
  createUser,
} from '@template/db/test';
import type { TokenWithRelations } from '#/lib/context/types';
import { spoofMiddleware } from '#/middleware/auth/spoofMiddleware';
import { createTestApp } from '#tests/createTestApp';

type Echo = { userId: string | null; spoofedById: string | null; tokenId: string | null };

const buildApp = (initial: { user: User; token?: Token }) =>
  createTestApp({
    mockUser: initial.user,
    mockToken: initial.token as TokenWithRelations | undefined,
    mount: [
      (app) => {
        app.use('*', spoofMiddleware);
        app.get('/echo', (c) =>
          c.json({
            userId: c.get('user')?.id ?? null,
            spoofedById: c.get('spoofedBy')?.id ?? null,
            tokenId: c.get('token')?.id ?? null,
          }),
        );
      },
    ],
  });

describe('spoofMiddleware via token auth', () => {
  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('superadmin authenticated via token can spoof another user', async () => {
    const { entity: admin } = await createUser({ platformRole: 'superadmin' });
    const { entity: target } = await createUser();
    const { entity: token } = await createToken({ ownerModel: 'User' }, { user: admin });

    const res = await buildApp({ user: admin, token }).fetch(
      new Request('http://test/echo', { headers: { 'x-spoof-user-email': target.email } }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Echo;
    expect(body.userId).toBe(target.id);
    expect(body.spoofedById).toBe(admin.id);
    expect(body.tokenId).toBe(token.id);
  });

  it('non-superadmin with token cannot spoof — header is ignored', async () => {
    const { entity: caller } = await createUser();
    const { entity: target } = await createUser();
    const { entity: token } = await createToken({ ownerModel: 'User' }, { user: caller });

    const res = await buildApp({ user: caller, token }).fetch(
      new Request('http://test/echo', { headers: { 'x-spoof-user-email': target.email } }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Echo;
    expect(body.userId).toBe(caller.id);
    expect(body.spoofedById).toBeNull();
  });

  it("spoofing replaces the superadmin's table with the spoofed user's", async () => {
    const { entity: adminSeat, context } = await createOrganizationUser(
      { role: 'owner' },
      { user: (await createUser({ platformRole: 'superadmin' })).entity },
    );
    const { entity: target } = await createUser();
    const app = createTestApp({
      mockUser: context.user,
      mockOrganizationUsers: [adminSeat],
      mount: [
        (hono) => {
          hono.use('*', spoofMiddleware);
          hono.get('/table', (c) =>
            c.json({
              grants: Object.keys(c.get('permix').getJSON() ?? {}),
              superadmin: c.get('permix').isSuperadmin(),
            }),
          );
        },
      ],
    });

    const res = await app.fetch(
      new Request('http://test/table', { headers: { 'x-spoof-user-email': target.email } }),
    );

    const body = (await res.json()) as { grants: string[]; superadmin: boolean };
    expect(body.superadmin).toBe(false);
    expect(body.grants).toEqual([`db:user:${target.id}`]);
  });
});
