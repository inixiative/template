import { expect } from 'bun:test';
import { type AccessorName, fetchOne, hydrate } from '@template/db';
import { check, rebacSchema } from '@template/permissions/rebac';
import { tokenAuthMiddleware } from '#/middleware/auth/tokenAuthMiddleware';
import { createTestApp, type MountFn } from '#tests/createTestApp';

export const createTokenProbeApp = (...mount: MountFn[]) => {
  const { app } = createTestApp({
    mount: [
      (hono) => {
        hono.use('*', tokenAuthMiddleware);
        hono.get('/api/v1/probe/actor', (c) => c.json({ actor: c.get('permix').getActor() }));
        hono.post('/api/v1/probe/holds', async (c) => {
          const { model, id, action } = (await c.req.json()) as {
            model: AccessorName;
            id: string;
            action: string;
          };
          const row = await fetchOne<{ id: string }>(model, id);
          if (!row) return c.json({ holds: false });
          const record = await hydrate(model, row);
          return c.json({ holds: check(c.get('permix'), rebacSchema, model, record, action) });
        });
      },
      ...mount,
    ],
  });

  const call = (key: string, method: string, path: string, body?: unknown) =>
    app.request(path, {
      method,
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  const holds = async (key: string, model: AccessorName, id: string, action: string) => {
    const response = await call(key, 'POST', '/api/v1/probe/holds', { model, id, action });
    expect(response.status).toBe(200);
    return ((await response.json()) as { holds: boolean }).holds;
  };

  return { app, call, holds };
};
