import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { db, getRedisClient } from '@template/db';
import { cleanupTouchedTables, createUser } from '@template/db/test';
import { apiRateLimit } from '#/middleware/rateLimit/apiRateLimit';
import { rateLimitMax } from '#/middleware/rateLimit/limits';
import { batchRouter } from '#/modules/batch';
import { meRouter } from '#/modules/me';
import { createTestApp, type MountFn } from '#tests/createTestApp';
import { json, post } from '#tests/utils/request';

const mount =
  (asBatchSubRequest: boolean): MountFn =>
  (app) => {
    if (asBatchSubRequest) {
      app.use('/rl', async (c, next) => {
        c.set('txn', db);
        await next();
      });
    }
    app.get('/rl', apiRateLimit, (c) => c.text('ok'));
  };

const hit = (fetch: (req: Request) => Promise<Response>, headers: Record<string, string> = {}) =>
  fetch(new Request('http://t/rl', { headers: { 'x-forwarded-for': '198.51.100.20', ...headers } }));

const overTheLimit = async (fetch: (req: Request) => Promise<Response>, headers?: Record<string, string>) => {
  const max = rateLimitMax('user', {} as never);
  const statuses: number[] = [];
  for (let i = 0; i <= max; i += 1) statuses.push((await hit(fetch, headers)).status);
  return statuses;
};

describe('apiRateLimit', () => {
  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  beforeEach(async () => {
    const keys = await getRedisClient().keys('limit:api:*');
    if (keys.length) await getRedisClient().del(...keys);
  });

  it('limits an ordinary request past the principal max', async () => {
    const { fetch } = createTestApp({ mount: [mount(false)] });
    const statuses = await overTheLimit(fetch);
    expect(statuses.at(-1)).toBe(429);
    expect(statuses.slice(0, -1).every((status) => status === 200)).toBe(true);
  });

  it('a spoofed x-batch-id header still counts', async () => {
    const { fetch } = createTestApp({ mount: [mount(false)] });
    const statuses = await overTheLimit(fetch, { 'x-batch-id': 'not-a-registered-batch' });
    expect(statuses.at(-1)).toBe(429);
  });

  it('a real batch pays once however many sub-requests it carries', async () => {
    const { entity: user } = await createUser();
    const { fetch } = createTestApp({
      mockUser: user,
      mount: [
        (app) => {
          app.use('/api/*', apiRateLimit);
          app.route('/api/v1/batch', batchRouter);
          app.route('/api/v1/me', meRouter);
        },
      ],
    });
    const max = rateLimitMax('user', {} as never);
    const requests = [Array.from({ length: max + 1 }, () => ({ method: 'GET', path: '/api/v1/me' }))];

    const response = await fetch(post('/api/v1/batch/execute', { requests }));
    expect(response.status).toBe(200);
    const { data } = await json<{ batch: { status: number }[][]; summary: { failedRequests: number } }>(response);
    expect(data.summary.failedRequests).toBe(0);
    expect(data.batch.flat().map((result) => result.status)).toEqual(Array(max + 1).fill(200));
  });

  it('a resolved batch sub-request is not counted', async () => {
    const { fetch } = createTestApp({ mount: [mount(true)] });
    const statuses = await overTheLimit(fetch);
    expect(statuses.every((status) => status === 200)).toBe(true);
  });
});
