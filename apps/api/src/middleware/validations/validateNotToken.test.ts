import { afterAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import type { Token, User } from '@template/db/generated/client/client';
import { cleanupTouchedTables, createToken, createUser } from '@template/db/test';
import type { TokenWithRelations } from '#/lib/context/types';
import { validateNotToken } from '#/middleware/validations/validateNotToken';
import { createTestApp } from '#tests/createTestApp';

const buildApp = (initial: { user?: User; token?: Token } = {}) =>
  createTestApp({
    mockUser: initial.user,
    mockToken: initial.token as TokenWithRelations | undefined,
    mount: [(app) => app.get('/protected', validateNotToken, (c) => c.json({ ok: true }))],
  });

describe('validateNotToken', () => {
  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('rejects unauthenticated request with 401', async () => {
    const res = await buildApp().fetch(new Request('http://test/protected'));
    expect(res.status).toBe(401);
  });

  it('rejects non-superadmin token with 403', async () => {
    const { entity: user } = await createUser();
    const { entity: token } = await createToken({ ownerModel: 'User' }, { user });
    const res = await buildApp({ user, token }).fetch(new Request('http://test/protected'));
    expect(res.status).toBe(403);
  });

  it('allows superadmin token through', async () => {
    const { entity: admin } = await createUser({ platformRole: 'superadmin' });
    const { entity: token } = await createToken({ ownerModel: 'User' }, { user: admin });
    const res = await buildApp({ user: admin, token }).fetch(new Request('http://test/protected'));
    expect(res.status).toBe(200);
  });

  it('allows session user (no token) through', async () => {
    const { entity: user } = await createUser();
    const res = await buildApp({ user }).fetch(new Request('http://test/protected'));
    expect(res.status).toBe(200);
  });
});
