import { afterAll, describe, expect, it } from 'bun:test';
import { OpenAPIHono, z } from '@hono/zod-openapi';
import { db } from '@template/db';
import { cleanupTouchedTables, createUser } from '@template/db/test';
import { app as productionApp } from '#/app';
import { validationDefaultHook } from '#/lib/openapi/validationDefaultHook';
import { actionRoute, readRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';
import type { AppEnv } from '#/types/appEnv';
import { createTestApp } from '#tests/createTestApp';
import { createBearerToken } from '#tests/utils/createBearerToken';
import { get, jsonError, post } from '#tests/utils/request';

const probeResponse = z.object({ accepted: z.boolean() });

const bodyProbeRoute = actionRoute({
  model: Modules.user,
  action: 'probeBody',
  skipId: true,
  bodySchema: z.object({ email: z.email() }),
  responseSchema: probeResponse,
});

const queryProbeRoute = readRoute({
  model: Modules.user,
  skipId: true,
  query: z.object({ email: z.email() }),
  responseSchema: probeResponse,
});

const mountProbes = (router: OpenAPIHono<AppEnv>) => {
  router.openapi(bodyProbeRoute, (c) => c.json({ data: { accepted: true } }, 200));
  router.openapi(queryProbeRoute, (c) => c.json({ data: { accepted: true } }, 200));
};

const expectValidationEnvelope = async (response: Response) => {
  expect(response.status).toBe(422);
  const body = await jsonError(response);
  expect(body).toMatchObject({
    error: 'VALIDATION_ERROR',
    message: 'Validation failed',
    guidance: 'fixInput',
    fieldErrors: { email: [expect.any(String)] },
  });
  expect(body.requestId).toEqual(expect.any(String));
  expect(body).not.toHaveProperty('success');
};

describe('validationDefaultHook', () => {
  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('is the production root default hook', () => {
    expect(productionApp.defaultHook).toBe(validationDefaultHook);
  });

  it('answers a validation failure on a production module route with the 422 envelope', async () => {
    const { entity: user } = await createUser();
    const { authorization } = await createBearerToken(user);

    const response = await productionApp.fetch(
      post(
        '/api/v1/me/contacts',
        {
          type: 'email',
          value: { address: 'a@example.com' },
          permissionRules: { read: { foo: 'bar' } },
        },
        { authorization },
      ),
    );

    expect(response.status).toBe(422);
    const body = await jsonError(response);
    expect(body).toMatchObject({ error: 'VALIDATION_ERROR', message: 'Validation failed' });
    expect(Object.keys(body.fieldErrors ?? {}).length).toBeGreaterThan(0);
    expect(response.headers.get('request-id')).toBe(body.requestId);
  });

  it('answers a body validation failure with the 422 envelope', async () => {
    const { fetch } = createTestApp({ mount: [mountProbes] });

    await expectValidationEnvelope(await fetch(post('/probeBody', { email: 'nope' })));
  });

  it('answers a query validation failure with the 422 envelope', async () => {
    const { fetch } = createTestApp({ mount: [mountProbes] });

    await expectValidationEnvelope(await fetch(get('/?email=nope')));
  });

  it('reaches routes registered on sub-apps mounted two levels below the root', async () => {
    const inner = new OpenAPIHono<AppEnv>();
    mountProbes(inner);
    const outer = new OpenAPIHono<AppEnv>();
    outer.route('/inner', inner);
    const { fetch } = createTestApp({ mount: [(root) => root.route('/outer', outer)] });

    await expectValidationEnvelope(await fetch(post('/outer/inner/probeBody', { email: 'nope' })));
  });

  it('leaves a router that is never mounted under a hooked root on the library default', async () => {
    const unmounted = new OpenAPIHono<AppEnv>();
    mountProbes(unmounted);

    const response = await unmounted.request(post('/probeBody', { email: 'nope' }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ success: false });
  });
});
