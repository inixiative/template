import { beforeEach, describe, expect, it } from 'bun:test';
import { OpenAPIHono, z } from '@hono/zod-openapi';
import { readRoute } from '#/lib/routeTemplates';
import { makeController } from '#/lib/utils/makeController';
import { Modules } from '#/modules/modules';
import type { AppEnv } from '#/types/appEnv';
import { json } from '#tests/utils/request';

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
});
