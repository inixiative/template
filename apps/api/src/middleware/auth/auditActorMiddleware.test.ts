import { afterAll, describe, expect, it } from 'bun:test';
import { OpenAPIHono } from '@hono/zod-openapi';
import { db } from '@template/db';
import type { User } from '@template/db/generated/client/client';
import { IntegrationOwnerModel } from '@template/db/generated/client/enums';
import { auditActorContext } from '@template/db/lib/auditActorContext';
import { cleanupTouchedTables, createIntegration, createUser } from '@template/db/test';
import { auditActorMiddleware } from '#/middleware/auth/auditActorMiddleware';
import { spoofMiddleware } from '#/middleware/auth/spoofMiddleware';
import { prepareRequest } from '#/middleware/prepareRequest';
import type { AppEnv } from '#/types/appEnv';

type Echo = { integrationId: string | null; actorUserId: string | null };

const buildApp = (user: User) => {
  const app = new OpenAPIHono<AppEnv>();
  app.use('*', prepareRequest);
  app.use('*', async (c, next) => {
    c.set('user', user);
    await next();
  });
  app.use('*', spoofMiddleware);
  app.use('*', auditActorMiddleware);
  app.get('/echo', (c) => {
    const actor = auditActorContext.getScope();
    return c.json({
      integrationId: actor?.integrationId ?? null,
      actorUserId: actor?.actorUserId ?? null,
    });
  });
  return app;
};

const echo = async (user: User, headers: Record<string, string>) => {
  const res = await buildApp(user).fetch(new Request('http://test/echo', { headers }));
  expect(res.status).toBe(200);
  return (await res.json()) as Echo;
};

describe('auditActorMiddleware x-integration-id', () => {
  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('carries an integration the caller owns', async () => {
    const { entity: owner, context } = await createUser();
    const { entity: integration } = await createIntegration(
      { ownerModel: IntegrationOwnerModel.User, userId: owner.id },
      context,
    );

    const body = await echo(owner, { 'x-integration-id': integration.id });

    expect(body.integrationId).toBe(integration.id);
  });

  it('ignores a superadmin asserting an integration they do not own', async () => {
    const { entity: admin } = await createUser({ platformRole: 'superadmin' });
    const { entity: owner, context } = await createUser();
    const { entity: integration } = await createIntegration(
      { ownerModel: IntegrationOwnerModel.User, userId: owner.id },
      context,
    );

    const body = await echo(admin, { 'x-integration-id': integration.id });

    expect(body.actorUserId).toBe(admin.id);
    expect(body.integrationId).toBeNull();
  });

  it('carries the spoofed user integration for a spoofing superadmin', async () => {
    const { entity: admin } = await createUser({ platformRole: 'superadmin' });
    const { entity: owner, context } = await createUser();
    const { entity: integration } = await createIntegration(
      { ownerModel: IntegrationOwnerModel.User, userId: owner.id },
      context,
    );

    const body = await echo(admin, {
      'x-spoof-user-email': owner.email,
      'x-integration-id': integration.id,
    });

    expect(body.integrationId).toBe(integration.id);
  });
});
