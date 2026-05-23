import { afterAll, describe, expect, it } from 'bun:test';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { Token, User } from '@template/db';
import { db } from '@template/db';
import { cleanupTouchedTables, createToken, createUser } from '@template/db/test';
import type { TokenWithRelations } from '#/lib/context/types';
import { prepareRequest } from '#/middleware/prepareRequest';
import { validateNotToken } from '#/middleware/validations/validateNotToken';
import type { AppEnv } from '#/types/appEnv';

const buildApp = (initial: { user?: User; token?: Token } = {}) => {
  const app = new OpenAPIHono<AppEnv>();
  app.use('*', prepareRequest);
  app.use('*', async (c, next) => {
    if (initial.user) c.set('user', initial.user);
    if (initial.token) c.set('token', initial.token as TokenWithRelations);
    await next();
  });
  app.get('/protected', validateNotToken, (c) => c.json({ ok: true }));
  return app;
};

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
    const { entity: token } = await createToken({}, { user });
    const res = await buildApp({ user, token }).fetch(new Request('http://test/protected'));
    expect(res.status).toBe(403);
  });

  it('allows superadmin token through', async () => {
    const { entity: admin } = await createUser({ platformRole: 'superadmin' });
    const { entity: token } = await createToken({}, { user: admin });
    const res = await buildApp({ user: admin, token }).fetch(new Request('http://test/protected'));
    expect(res.status).toBe(200);
  });

  it('allows session user (no token) through', async () => {
    const { entity: user } = await createUser();
    const res = await buildApp({ user }).fetch(new Request('http://test/protected'));
    expect(res.status).toBe(200);
  });
});
