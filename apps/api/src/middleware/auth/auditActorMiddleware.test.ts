import { afterAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { IntegrationOwnerModel } from '@template/db/generated/client/enums';
import { auditActorContext } from '@template/db/lib/auditActorContext';
import { cleanupTouchedTables, createIntegration, createUser } from '@template/db/test';
import { auditActorMiddleware } from '#/middleware/auth/auditActorMiddleware';
import { jwtAuthMiddleware } from '#/middleware/auth/jwtAuthMiddleware';
import { spoofMiddleware } from '#/middleware/auth/spoofMiddleware';
import { tokenAuthMiddleware } from '#/middleware/auth/tokenAuthMiddleware';
import { createTestApp } from '#tests/createTestApp';
import { createBearerToken } from '#tests/utils/createBearerToken';
import { createUserJwt } from '#tests/utils/createUserJwt';

type Echo = { integrationId: string | null; actorUserId: string | null };

const { fetch } = createTestApp({
  mount: [
    (app) => {
      app.use('*', jwtAuthMiddleware);
      app.use('*', tokenAuthMiddleware);
      app.use('*', spoofMiddleware);
      app.use('*', auditActorMiddleware);
      app.get('/echo', (c) => {
        const actor = auditActorContext.getScope();
        return c.json({
          integrationId: actor?.integrationId ?? null,
          actorUserId: actor?.actorUserId ?? null,
        });
      });
    },
  ],
});

const echo = async (headers: Record<string, string>) => {
  const res = await fetch(new Request('http://test/echo', { headers }));
  expect(res.status).toBe(200);
  return (await res.json()) as Echo;
};

describe('auditActorMiddleware: the audit origin is the credential binding', () => {
  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('a token bound to an integration carries it as the origin', async () => {
    const { entity: owner, context } = await createUser();
    const { entity: integration } = await createIntegration(
      { ownerModel: IntegrationOwnerModel.User, userId: owner.id },
      context,
    );
    const { authorization } = await createBearerToken(owner, { integrationId: integration.id });

    const body = await echo({ authorization });

    expect(body.actorUserId).toBe(owner.id);
    expect(body.integrationId).toBe(integration.id);
  });

  it('a person has no origin, and an x-integration-id header is ignored', async () => {
    const { entity: owner, context } = await createUser();
    const { entity: integration } = await createIntegration(
      { ownerModel: IntegrationOwnerModel.User, userId: owner.id },
      context,
    );
    const { authorization } = await createUserJwt(owner);

    const body = await echo({ authorization, 'x-integration-id': integration.id });

    expect(body.actorUserId).toBe(owner.id);
    expect(body.integrationId).toBeNull();
  });

  it('an unbound token has no origin, whatever it asserts', async () => {
    const { entity: owner, context } = await createUser();
    const { entity: integration } = await createIntegration(
      { ownerModel: IntegrationOwnerModel.User, userId: owner.id },
      context,
    );
    const { authorization } = await createBearerToken(owner);

    const body = await echo({ authorization, 'x-integration-id': integration.id });

    expect(body.integrationId).toBeNull();
  });
});
