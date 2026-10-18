import { describe, expect, it } from 'bun:test';
import { OpenAPIHono, z } from '@hono/zod-openapi';
import { actionRoute, polymorphicBodyRefinement } from '#/lib/routeTemplates';
import { makeController } from '#/lib/utils/makeController';
import { Modules } from '#/modules/modules';
import type { AppEnv } from '#/types/appEnv';
import { jsonValidationFailure, post } from '#tests/utils/request';

const ownerBodySchema = z.object({
  ownerModel: z.enum(['User', 'Organization', 'Space']),
  userId: z.string().optional(),
  organizationId: z.string().optional(),
  spaceId: z.string().optional(),
  label: z.string(),
});

const mountOwnerRoute = () => {
  const route = actionRoute({
    model: Modules.integration,
    action: 'owner',
    skipId: true,
    bodySchema: ownerBodySchema,
    bodyRefinement: polymorphicBodyRefinement('Integration', 'ownerModel', {
      only: ['User', 'Organization', 'Space'],
      omit: ['userId'],
    }),
    responseSchema: z.object({ ran: z.boolean() }),
  });
  const app = new OpenAPIHono<AppEnv>();
  app.openapi(
    route,
    makeController(route, (_c, respond) => respond.ok({ ran: true })),
  );
  return app;
};

const issuesOf = async (response: Response) => {
  const body = await jsonValidationFailure(response);
  return JSON.parse(body.error.message) as { path: (string | number)[]; code: string }[];
};

describe('polymorphicBodyRefinement', () => {
  const organizationId = Bun.randomUUIDv7();
  const spaceId = Bun.randomUUIDv7();

  it('passes a body whose axis columns match one arm, ignoring non-axis fields', async () => {
    const response = await mountOwnerRoute().request(
      post('/owner', { ownerModel: 'Space', organizationId, spaceId, label: 'x' }),
    );

    expect(response.status).toBe(200);
  });

  it('rejects a missing FK for the chosen arm', async () => {
    const response = await mountOwnerRoute().request(
      post('/owner', { ownerModel: 'Space', organizationId, label: 'x' }),
    );

    expect(response.status).toBe(400);
    expect((await issuesOf(response)).map((issue) => issue.path)).toEqual([['spaceId']]);
  });

  it('rejects an FK from another arm', async () => {
    const response = await mountOwnerRoute().request(
      post('/owner', { ownerModel: 'Organization', organizationId, spaceId, label: 'x' }),
    );

    expect(response.status).toBe(400);
    expect((await issuesOf(response)).map((issue) => issue.code)).toEqual(['unrecognized_keys']);
  });

  it('rejects an omitted FK the server fills', async () => {
    const response = await mountOwnerRoute().request(
      post('/owner', { ownerModel: 'User', userId: Bun.randomUUIDv7(), label: 'x' }),
    );

    expect(response.status).toBe(400);
    expect((await issuesOf(response)).map((issue) => issue.code)).toEqual(['unrecognized_keys']);
  });

  it('rejects an FK that is not a uuid v7', async () => {
    const response = await mountOwnerRoute().request(
      post('/owner', { ownerModel: 'Organization', organizationId: 'nope', label: 'x' }),
    );

    expect(response.status).toBe(400);
    expect((await issuesOf(response)).map((issue) => issue.path)).toEqual([['organizationId']]);
  });
});
