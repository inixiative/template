import { describe, expect, it } from 'bun:test';
import { z } from '@hono/zod-openapi';
import { actionRoute, createRoute, readRoute } from '#/lib/routeTemplates';
import { sanitizeRequestSchema } from '#/lib/routeTemplates/utils/sanitizeRequestSchema';
import { toOpenApi } from '#/lib/routeTemplates/utils/toOpenApi';
import { makeController } from '#/lib/utils/makeController';
import { Modules } from '#/modules/modules';
import { createTestApp } from '#tests/createTestApp';
import { get, parseErrorBody, parseSuccessBody, post } from '#tests/utils/request';

const ranResponse = z.object({ ran: z.boolean() });

describe('makeController', () => {
  describe('response validation', () => {
    it('strips extra fields not in response schema', async () => {
      const testRoute = readRoute({
        model: Modules.user,
        skipId: true,
        responseSchema: z.object({
          id: z.string(),
          name: z.string(),
        }),
      });

      const controller = makeController(testRoute, (_c, respond) => {
        const row = {
          id: 'user-123',
          name: 'Test User',
          email: 'test@example.com',
          secret: 'should-be-stripped',
        };
        return respond.ok(row);
      });

      const { fetch } = createTestApp({ mount: [(app) => app.openapi(testRoute, controller)] });

      const response = await fetch(get('/'));
      const { data } = await parseSuccessBody<Record<string, unknown>>(response);

      expect(response.status).toBe(200);
      expect(data).toEqual({ id: 'user-123', name: 'Test User' });
      expect(data.email).toBeUndefined();
      expect(data.secret).toBeUndefined();
    });

    it('strips extra fields from array responses', async () => {
      const testRoute = readRoute({
        model: Modules.user,
        many: true,
        skipId: true,
        responseSchema: z.object({
          id: z.string(),
          name: z.string(),
        }),
      });

      const controller = makeController(testRoute, (_c, respond) => {
        const rows = [
          { id: '1', name: 'User 1', secret: 'hidden1' },
          { id: '2', name: 'User 2', secret: 'hidden2' },
        ];
        return respond.ok(rows);
      });

      const { fetch } = createTestApp({ mount: [(app) => app.openapi(testRoute, controller)] });

      const response = await fetch(get('/'));
      const { data } = await parseSuccessBody<Record<string, unknown>[]>(response);

      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(data[0]).toEqual({ id: '1', name: 'User 1' });
      expect(data[1]).toEqual({ id: '2', name: 'User 2' });
      expect(data[0].secret).toBeUndefined();
    });

    it('strips nested extra fields', async () => {
      const testRoute = readRoute({
        model: Modules.user,
        skipId: true,
        responseSchema: z.object({
          id: z.string(),
          profile: z.object({
            displayName: z.string(),
          }),
        }),
      });

      const controller = makeController(testRoute, (_c, respond) => {
        const row = {
          id: 'user-123',
          profile: {
            displayName: 'Test',
            privateData: 'should-be-stripped',
          },
        };
        return respond.ok(row);
      });

      const { fetch } = createTestApp({ mount: [(app) => app.openapi(testRoute, controller)] });

      const response = await fetch(get('/'));
      const { data } = await parseSuccessBody<{ id: string; profile: Record<string, unknown> }>(
        response,
      );

      expect(response.status).toBe(200);
      expect(data.profile).toEqual({ displayName: 'Test' });
      expect(data.profile.privateData).toBeUndefined();
    });
  });

  describe('request refinements', () => {
    const rangeSchema = z.object({ min: z.number(), max: z.number() });
    const rangeRefinement = (range: { min: number; max: number }, ctx: z.RefinementCtx) => {
      if (range.min > range.max)
        ctx.addIssue({ code: 'custom', path: ['min'], message: 'min must not exceed max' });
    };

    const rangeRoute = (bodyRequired?: boolean) => {
      const route = actionRoute({
        model: Modules.user,
        action: 'range',
        skipId: true,
        bodySchema: rangeSchema,
        bodyRequired,
        bodyRefinement: rangeRefinement,
        responseSchema: ranResponse,
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

    it('answers a failed refinement with the same 422 envelope as a schema failure', async () => {
      const fetch = rangeRoute();

      const refinementResponse = await fetch(post('/range', { min: 5, max: 1 }));
      const schemaResponse = await fetch(post('/range', { min: 'five', max: 1 }));
      const refinementBody = await parseErrorBody(refinementResponse);
      const schemaBody = await parseErrorBody(schemaResponse);

      expect(refinementResponse.status).toBe(422);
      expect(schemaResponse.status).toBe(422);
      expect(Object.keys(refinementBody).sort()).toEqual(Object.keys(schemaBody).sort());
      expect(refinementBody).toMatchObject({
        error: 'VALIDATION_ERROR',
        fieldErrors: { min: ['min must not exceed max'] },
      });
    });

    it('runs the controller when the refinement passes', async () => {
      const response = await rangeRoute()(post('/range', { min: 1, max: 5 }));
      const { data } = await parseSuccessBody<{ ran: boolean }>(response);

      expect(response.status).toBe(200);
      expect(data.ran).toBe(true);
    });

    it('skips the body refinement when an optional body is omitted', async () => {
      const route = actionRoute({
        model: Modules.user,
        action: 'range',
        skipId: true,
        bodySchema: rangeSchema.partial(),
        bodyRequired: false,
        bodyRefinement: (range: Partial<z.infer<typeof rangeSchema>>, ctx) => {
          if (range.min === undefined) ctx.addIssue({ code: 'custom', message: 'refinement ran' });
        },
        responseSchema: ranResponse,
      });

      const { fetch } = createTestApp({
        mount: [
          (app) =>
            app.openapi(
              route,
              makeController(route, (_c, respond) => respond.ok({ ran: true })),
            ),
        ],
      });

      const response = await fetch(new Request('http://t/range', { method: 'POST' }));

      expect(response.status).toBe(200);
    });

    it('awaits an async refinement', async () => {
      const route = actionRoute({
        model: Modules.user,
        action: 'range',
        skipId: true,
        bodySchema: rangeSchema,
        bodyRefinement: async (range: z.infer<typeof rangeSchema>, ctx) => {
          await Promise.resolve();
          rangeRefinement(range, ctx);
        },
        responseSchema: ranResponse,
      });
      const { fetch } = createTestApp({
        mount: [
          (app) =>
            app.openapi(
              route,
              makeController(route, (_c, respond) => respond.ok({ ran: true })),
            ),
        ],
      });

      const rejected = await fetch(post('/range', { min: 5, max: 1 }));
      const accepted = await fetch(post('/range', { min: 1, max: 5 }));

      expect(rejected.status).toBe(422);
      expect((await parseErrorBody(rejected)).fieldErrors).toEqual({
        min: ['min must not exceed max'],
      });
      expect(accepted.status).toBe(200);
    });

    it('refines each item of a many body', async () => {
      const route = createRoute({
        model: Modules.user,
        many: true,
        bodySchema: rangeSchema,
        bodyRefinement: rangeRefinement,
        responseSchema: ranResponse,
      });
      const { fetch } = createTestApp({
        mount: [
          (app) =>
            app.openapi(
              route,
              makeController(route, (_c, respond) => respond.created([{ ran: true }])),
            ),
        ],
      });

      const response = await fetch(
        post('/', [
          { min: 1, max: 5 },
          { min: 9, max: 2 },
        ]),
      );

      expect(response.status).toBe(422);
      expect((await parseErrorBody(response)).fieldErrors).toEqual({
        '1.min': ['min must not exceed max'],
      });
    });

    it('refuses to build a route whose body schema carries a refinement', () => {
      expect(() =>
        actionRoute({
          model: Modules.user,
          action: 'range',
          skipId: true,
          bodySchema: rangeSchema.refine((range) => range.min <= range.max),
          responseSchema: ranResponse,
        }),
      ).toThrow('pass them as bodyRefinement instead');
    });

    it('rejects a query that fails the query refinement', async () => {
      const route = readRoute({
        model: Modules.user,
        action: 'range',
        skipId: true,
        query: z.object({ min: z.coerce.number(), max: z.coerce.number() }),
        queryRefinement: rangeRefinement,
        responseSchema: ranResponse,
      });
      const { fetch } = createTestApp({
        mount: [
          (app) =>
            app.openapi(
              route,
              makeController(route, (_c, respond) => respond.ok({ ran: true })),
            ),
        ],
      });

      const rejected = await fetch(get('/range?min=5&max=1'));
      const accepted = await fetch(get('/range?min=1&max=5'));

      expect(rejected.status).toBe(422);
      expect((await parseErrorBody(rejected)).fieldErrors).toEqual({
        min: ['min must not exceed max'],
      });
      expect(accepted.status).toBe(200);
    });

    it('refuses a refinement on a route without a body', () => {
      const route = actionRoute({
        model: Modules.user,
        action: 'range',
        skipId: true,
        bodyRefinement: () => undefined,
        responseSchema: ranResponse,
      });

      expect(() => makeController(route, (_c, respond) => respond.ok({ ran: true }))).toThrow(
        'bodyRefinement requires a JSON body schema',
      );
    });
  });

  describe('pagination & typing contracts', () => {
    it('accepts cursor pagination metadata without total on paginate: "cursor" routes', async () => {
      const route = readRoute({
        model: Modules.user,
        many: true,
        paginate: 'cursor',
        responseSchema: z.object({ id: z.string() }),
      });

      const { fetch } = createTestApp({
        mount: [
          (app) =>
            app.openapi(
              route,
              makeController(route, (_c, respond) =>
                respond.ok([{ id: 'u1' }], {
                  pagination: { pageSize: 10, hasMore: true, nextCursor: 'u1' },
                }),
              ),
            ),
        ],
      });

      const response = await fetch(get('/'));
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({
        data: [{ id: 'u1' }],
        pagination: { pageSize: 10, hasMore: true, nextCursor: 'u1' },
      });
    });

    it('rejects offset pagination metadata on paginate: "cursor" routes', async () => {
      const route = readRoute({
        model: Modules.user,
        many: true,
        paginate: 'cursor',
        responseSchema: z.object({ id: z.string() }),
      });

      const { fetch } = createTestApp({
        mount: [
          (app) =>
            app.openapi(
              route,
              makeController(route, (_c, respond) =>
                respond.ok([{ id: 'u1' }], {
                  // @ts-expect-error offset pagination does not satisfy cursor pagination schema
                  pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
                }),
              ),
            ),
        ],
      });

      const response = await fetch(get('/'));
      expect(response.status).toBe(500);
    });

    it('rejects cursor pagination metadata on offset paginate: true routes', async () => {
      const route = readRoute({
        model: Modules.user,
        many: true,
        paginate: true,
        responseSchema: z.object({ id: z.string() }),
      });

      const { fetch } = createTestApp({
        mount: [
          (app) =>
            app.openapi(
              route,
              makeController(route, (_c, respond) =>
                respond.ok([{ id: 'u1' }], {
                  // @ts-expect-error cursor pagination does not satisfy offset pagination schema
                  pagination: { pageSize: 10, hasMore: false, nextCursor: null },
                }),
              ),
            ),
        ],
      });

      const response = await fetch(get('/'));
      expect(response.status).toBe(500);
    });

    it('enforces status code and many shape at compile time', () => {
      const singleCreate = createRoute({
        model: Modules.user,
        bodySchema: z.object({ name: z.string() }),
        responseSchema: ranResponse,
      });
      const manyRead = readRoute({
        model: Modules.user,
        many: true,
        responseSchema: ranResponse,
      });

      const _compileChecks = () => {
        makeController(singleCreate, (_c, respond) =>
          // @ts-expect-error createRoute only exposes 201 (created), not 200 (ok)
          respond.ok({ ran: true }),
        );
        makeController(manyRead, (_c, respond) =>
          // @ts-expect-error readRoute only exposes 200 (ok), not 201 (created)
          respond.created([{ ran: true }]),
        );
        makeController(manyRead, (_c, respond) =>
          // @ts-expect-error many: true requires an array payload
          respond.ok({ ran: true }),
        );
      };

      expect(typeof _compileChecks).toBe('function');
    });

    it('strips builder-only fields like bodyRequired and includeDeleted from OpenAPI route config', () => {
      const route = actionRoute({
        model: Modules.user,
        action: 'probe',
        skipId: true,
        bodySchema: z.object({ name: z.string() }),
        bodyRequired: false,
        includeDeleted: true,
        responseSchema: ranResponse,
      });

      const openApiRoute = toOpenApi(route);
      expect('bodyRequired' in openApiRoute).toBe(false);
      expect('includeDeleted' in openApiRoute).toBe(false);
    });

    it('preserves passthrough and strict catchall behavior in sanitizeRequestSchema', () => {
      const passthrough = sanitizeRequestSchema(
        z.object({ id: z.string(), name: z.string() }).passthrough(),
      );
      const strict = sanitizeRequestSchema(z.object({ id: z.string(), name: z.string() }).strict());

      expect(
        passthrough.parse({ name: 'ok', extra: 42 } as unknown) as Record<string, unknown>,
      ).toEqual({
        name: 'ok',
        extra: 42,
      });
      expect(() => strict.parse({ name: 'ok', extra: 42 } as unknown)).toThrow();
    });
  });
});
