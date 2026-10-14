import { beforeEach, describe, expect, it } from 'bun:test';
import { OpenAPIHono, z } from '@hono/zod-openapi';
import { actionRoute, createRoute, readRoute } from '#/lib/routeTemplates';
import { makeController } from '#/lib/utils/makeController';
import { Modules } from '#/modules/modules';
import type { AppEnv } from '#/types/appEnv';
import { json, jsonValidationFailure, post } from '#tests/utils/request';

describe('makeController', () => {
  describe('response validation', () => {
    let app: OpenAPIHono<AppEnv>;

    beforeEach(() => {
      app = new OpenAPIHono<AppEnv>();
    });

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

      app.openapi(testRoute, controller);

      const response = await app.request('/', { method: 'GET' });
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

      app.openapi(testRoute, controller);

      const response = await app.request('/', { method: 'GET' });
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

      app.openapi(testRoute, controller);

      const response = await app.request('/', { method: 'GET' });
      const { data } = await json<{ id: string; profile: Record<string, unknown> }>(response);

      expect(response.status).toBe(200);
      expect(data.profile).toEqual({ displayName: 'Test' });
      expect(data.profile.privateData).toBeUndefined();
    });
  });

  describe('body refinement', () => {
    const rangeSchema = z.object({ min: z.number(), max: z.number() });
    const rangeRefinement = (range: { min: number; max: number }, ctx: z.RefinementCtx) => {
      if (range.min > range.max)
        ctx.addIssue({ code: 'custom', path: ['min'], message: 'min must not exceed max' });
    };

    const mountRange = (bodyRequired?: boolean) => {
      const route = actionRoute({
        model: Modules.user,
        action: 'range',
        skipId: true,
        bodySchema: rangeSchema,
        bodyRequired,
        bodyRefinement: rangeRefinement,
        responseSchema: z.object({ ran: z.boolean() }),
      });
      const app = new OpenAPIHono<AppEnv>();
      app.openapi(
        route,
        makeController(route, (_c, respond) => respond.ok({ ran: true })),
      );
      return app;
    };

    it('rejects a body that fails the refinement with the schema-failure 400', async () => {
      const app = mountRange();

      const refinementResponse = await app.request(post('/range', { min: 5, max: 1 }));
      const schemaResponse = await app.request(post('/range', { min: 'five', max: 1 }));
      const refinementBody = await jsonValidationFailure(refinementResponse);
      const schemaBody = await jsonValidationFailure(schemaResponse);

      expect(refinementResponse.status).toBe(400);
      expect(schemaResponse.status).toBe(400);
      expect(Object.keys(refinementBody).sort()).toEqual(Object.keys(schemaBody).sort());
      expect(refinementBody.success).toBe(false);
      expect(refinementBody.error.name).toBe(schemaBody.error.name);
      expect(refinementBody.error.message).toContain('min must not exceed max');
    });

    it('runs the controller when the refinement passes', async () => {
      const response = await mountRange().request(post('/range', { min: 1, max: 5 }));
      const { data } = await json<{ ran: boolean }>(response);

      expect(response.status).toBe(200);
      expect(data.ran).toBe(true);
    });

    it('skips the refinement when an optional body is omitted', async () => {
      const response = await mountRange(false).request(
        new Request('http://t/range', { method: 'POST' }),
      );

      expect(response.status).toBe(200);
    });

    it('refines each item of a many body', async () => {
      const route = createRoute({
        model: Modules.user,
        many: true,
        bodySchema: rangeSchema,
        bodyRefinement: rangeRefinement,
        responseSchema: z.object({ ran: z.boolean() }),
      });
      const app = new OpenAPIHono<AppEnv>();
      app.openapi(
        route,
        makeController(route, (_c, respond) => respond.created({ ran: true })),
      );

      const response = await app.request(
        post('/', [
          { min: 1, max: 5 },
          { min: 9, max: 2 },
        ]),
      );
      const body = await jsonValidationFailure(response);

      const issues = JSON.parse(body.error.message) as { path: (string | number)[] }[];

      expect(response.status).toBe(400);
      expect(issues.map((issue) => issue.path)).toEqual([[1, 'min']]);
    });

    it('refuses to build a route whose body schema carries a refinement', () => {
      expect(() =>
        actionRoute({
          model: Modules.user,
          action: 'range',
          skipId: true,
          bodySchema: rangeSchema.refine((range) => range.min <= range.max),
          responseSchema: z.object({ ran: z.boolean() }),
        }),
      ).toThrow('pass them as bodyRefinement instead');
    });

    it('refuses a refinement on a route without a body', () => {
      const route = actionRoute({
        model: Modules.user,
        action: 'range',
        skipId: true,
        bodyRefinement: () => undefined,
        responseSchema: z.object({ ran: z.boolean() }),
      });

      expect(() => makeController(route, (_c, respond) => respond.ok({ ran: true }))).toThrow(
        'bodyRefinement requires a JSON body schema',
      );
    });
  });
});
