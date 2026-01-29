import { beforeEach, describe, expect, it } from 'bun:test';
import { OpenAPIHono, z } from '@hono/zod-openapi';
import { readRoute } from '#/lib/routeTemplates';
import { makeController } from '#/lib/utils/makeController';
import { Modules } from '#/modules/modules';

describe('makeController', () => {
  describe('response validation', () => {
    let app: OpenAPIHono;

    beforeEach(() => {
      app = new OpenAPIHono();
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
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data).toEqual({ id: 'user-123', name: 'Test User' });
      expect(body.data.email).toBeUndefined();
      expect(body.data.secret).toBeUndefined();
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
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data).toHaveLength(2);
      expect(body.data[0]).toEqual({ id: '1', name: 'User 1' });
      expect(body.data[1]).toEqual({ id: '2', name: 'User 2' });
      expect(body.data[0].secret).toBeUndefined();
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
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.profile).toEqual({ displayName: 'Test' });
      expect(body.data.profile.privateData).toBeUndefined();
    });
  });
});
