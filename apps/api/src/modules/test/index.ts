/**
 * Test module - mock webhook receiver for testing webhook delivery
 * Only mounted in test environment (check is in routes/index.ts)
 */
import { OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '#/types/appEnv';

export const testRouter = new OpenAPIHono<AppEnv>();

// Store for received webhooks (in-memory, resets between tests)
export const receivedWebhooks: Array<{
  body: unknown;
  headers: Record<string, string>;
  timestamp: Date;
}> = [];

export const clearReceivedWebhooks = () => {
  receivedWebhooks.length = 0;
};

// Mock webhook receiver endpoint
testRouter.post('/webhook', async (c) => {
  const body = await c.req.json();
  const headers: Record<string, string> = {};
  c.req.raw.headers.forEach((value, key) => {
    headers[key] = value;
  });

  receivedWebhooks.push({ body, headers, timestamp: new Date() });

  return c.json({ ok: true }, 200);
});
