import { afterAll, describe, expect, it } from 'bun:test';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { Token, User } from '@template/db';
import { db } from '@template/db';
import { cleanupTouchedTables, createToken, createUser } from '@template/db/test';
import type { TokenWithRelations } from '#/lib/context/types';
import { spoofMiddleware } from '#/middleware/auth/spoofMiddleware';
import { prepareRequest } from '#/middleware/prepareRequest';
import type { AppEnv } from '#/types/appEnv';

const buildApp = (initial: { user: User; token?: Token }) => {
  const app = new OpenAPIHono<AppEnv>();
  app.use('*', prepareRequest);
  app.use('*', async (c, next) => {
    c.set('user', initial.user);
    if (initial.token) c.set('token', initial.token as TokenWithRelations);
    await next();
  });
  app.use('*', spoofMiddleware);
  app.get('/echo', (c) =>
    c.json({
      userId: c.get('user')?.id ?? null,
      spoofedById: c.get('spoofedBy')?.id ?? null,
      tokenId: c.get('token')?.id ?? null,
    }),
  );
  return app;
};

describe('spoofMiddleware via token auth', () => {
  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('superadmin authenticated via token can spoof another user', async () => {
    const { entity: admin } = await createUser({ platformRole: 'superadmin' });
    const { entity: target } = await createUser();
    const { entity: token } = await createToken({}, { user: admin });

    const res = await buildApp({ user: admin, token }).fetch(
      new Request('http://test/echo', { headers: { 'x-spoof-user-email': target.email } }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe(target.id);
    expect(body.spoofedById).toBe(admin.id);
    expect(body.tokenId).toBe(token.id);
  });

  it('non-superadmin with token cannot spoof — header is ignored', async () => {
    const { entity: caller } = await createUser();
    const { entity: target } = await createUser();
    const { entity: token } = await createToken({}, { user: caller });

    const res = await buildApp({ user: caller, token }).fetch(
      new Request('http://test/echo', { headers: { 'x-spoof-user-email': target.email } }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe(caller.id);
    expect(body.spoofedById).toBeNull();
  });
});
