import { describe, expect, it } from 'bun:test';
import { z } from '@hono/zod-openapi';
import { actionRoute, polymorphicBodyRefinement } from '#/lib/routeTemplates';
import { makeController } from '#/lib/utils/makeController';
import { Modules } from '#/modules/modules';
import { createTestApp } from '#tests/createTestApp';
import { jsonError, post } from '#tests/utils/request';

const ownerBodySchema = z.object({
  ownerModel: z.enum(['User', 'Organization', 'Space']),
  userId: z.string().nullish(),
  organizationId: z.string().nullish(),
  spaceId: z.string().nullish(),
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
  return createTestApp({
    mount: [
      (app) =>
        app.openapi(
          route,
          makeController(route, (_c, respond) => respond.ok({ ran: true })),
        ),
    ],
  }).fetch;
};

const fieldErrorsOf = async (response: Response) => {
  expect(response.status).toBe(422);
  return (await jsonError(response)).fieldErrors ?? {};
};

describe('polymorphicBodyRefinement', () => {
  const organizationId = Bun.randomUUIDv7();
  const spaceId = Bun.randomUUIDv7();

  it('passes a body whose axis columns match one arm, ignoring non-axis fields', async () => {
    const response = await mountOwnerRoute()(
      post('/owner', { ownerModel: 'Space', organizationId, spaceId, label: 'x' }),
    );

    expect(response.status).toBe(200);
  });

  it('rejects a missing FK for the chosen arm', async () => {
    const response = await mountOwnerRoute()(
      post('/owner', { ownerModel: 'Space', organizationId, label: 'x' }),
    );

    expect(Object.keys(await fieldErrorsOf(response))).toEqual(['spaceId']);
  });

  it('rejects an FK from another arm', async () => {
    const response = await mountOwnerRoute()(
      post('/owner', { ownerModel: 'Organization', organizationId, spaceId, label: 'x' }),
    );

    expect(Object.values(await fieldErrorsOf(response)).flat()).toEqual([
      expect.stringContaining('Unrecognized key'),
    ]);
  });

  it('rejects an omitted FK the server fills', async () => {
    const response = await mountOwnerRoute()(
      post('/owner', { ownerModel: 'User', userId: Bun.randomUUIDv7(), label: 'x' }),
    );

    expect(Object.values(await fieldErrorsOf(response)).flat()).toEqual([
      expect.stringContaining('Unrecognized key'),
    ]);
  });

  it('rejects an FK that is not a uuid v7', async () => {
    const response = await mountOwnerRoute()(
      post('/owner', { ownerModel: 'Organization', organizationId: 'nope', label: 'x' }),
    );

    expect(Object.keys(await fieldErrorsOf(response))).toEqual(['organizationId']);
  });

  it('reads a null FK from another arm as absent, as the write rule does', async () => {
    const response = await mountOwnerRoute()(
      post('/owner', { ownerModel: 'Organization', organizationId, spaceId: null, label: 'x' }),
    );

    expect(response.status).toBe(200);
  });

  it('reads a null FK the chosen arm requires as missing', async () => {
    const response = await mountOwnerRoute()(
      post('/owner', { ownerModel: 'Space', organizationId, spaceId: null, label: 'x' }),
    );

    expect(Object.keys(await fieldErrorsOf(response))).toEqual(['spaceId']);
  });
});
