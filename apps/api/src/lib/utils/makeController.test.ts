import { describe, expect, it } from 'bun:test';
import { z } from '@hono/zod-openapi';
import { actionRoute, createRoute, readRoute } from '#/lib/routeTemplates';
import { makeController } from '#/lib/utils/makeController';
import { Modules } from '#/modules/modules';
import { createTestApp } from '#tests/createTestApp';
import { get, json, jsonError, post } from '#tests/utils/request';

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
        return respond.ok({
          id: 'user-123',
          name: 'Test User',
          email: 'test@example.com',
          secret: 'should-be-stripped',
        });
      });

      const { fetch } = createTestApp({ mount: [(app) => app.openapi(testRoute, controller)] });

      const response = await fetch(get('/'));
      const { data } = await json<Record<string, unknown>>(response);

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
        return respond.ok([
          { id: '1', name: 'User 1', secret: 'hidden1' },
          { id: '2', name: 'User 2', secret: 'hidden2' },
        ]);
      });

      const { fetch } = createTestApp({ mount: [(app) => app.openapi(testRoute, controller)] });

      const response = await fetch(get('/'));
      const { data } = await json<Record<string, unknown>[]>(response);

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
        return respond.ok({
          id: 'user-123',
          profile: {
            displayName: 'Test',
            privateData: 'should-be-stripped',
          },
        });
      });

      const { fetch } = createTestApp({ mount: [(app) => app.openapi(testRoute, controller)] });

      const response = await fetch(get('/'));
      const { data } = await json<{ id: string; profile: Record<string, unknown> }>(response);

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
      const refinementBody = await jsonError(refinementResponse);
      const schemaBody = await jsonError(schemaResponse);

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
      const { data } = await json<{ ran: boolean }>(response);

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
      expect((await jsonError(rejected)).fieldErrors).toEqual({
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
              makeController(route, (_c, respond) => respond.created({ ran: true })),
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
      expect((await jsonError(response)).fieldErrors).toEqual({
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
      expect((await jsonError(rejected)).fieldErrors).toEqual({
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
});
