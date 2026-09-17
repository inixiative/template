import { beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { getRedisClient } from '@template/db';
import { clientIp } from '#/lib/clientIp';
import { type RateLimitRule, rateLimit } from '#/middleware/rateLimit/rateLimit';
import { createTestApp, type MountFn } from '#tests/createTestApp';

const mount =
  (rules: RateLimitRule[]): MountFn =>
  (app) => {
    app.get('/rl', rateLimit(rules), (c) => c.text('ok'));
  };

const ipRule = (over: Partial<RateLimitRule> = {}): RateLimitRule => ({
  scope: 'test:ip',
  windowMs: 60_000,
  max: 2,
  key: (c) => `ip:${clientIp(c)}`,
  ...over,
});

const hit = (fetchFromApp: (req: Request) => Promise<Response>, xff: string, extra: Record<string, string> = {}) =>
  fetchFromApp(new Request('http://t/rl', { headers: { 'x-forwarded-for': xff, ...extra } }));

describe('rateLimit', () => {
  beforeEach(async () => {
    const keys = await getRedisClient().keys('limit:test:*');
    if (keys.length) await getRedisClient().del(...keys);
  });

  it('allows up to max, then 429s with Retry-After and the error envelope', async () => {
    const { fetch } = createTestApp({ mount: [mount([ipRule({ max: 2 })])] });

    expect((await hit(fetch, '1.1.1.1')).status).toBe(200);
    expect((await hit(fetch, '1.1.1.1')).status).toBe(200);
    const limited = await hit(fetch, '1.1.1.1');
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect(limited.headers.get('Cache-Control')).toBe('no-store');
    expect(await limited.json()).toMatchObject({
      error: 'RATE_LIMITED',
      message: 'Rate limit exceeded',
      guidance: 'tryAgain',
      requestId: expect.any(String),
    });
  });

  it('hands the limited response to onLimited when one is given', async () => {
    const { fetch } = createTestApp({
      mount: [
        (app) => {
          app.get(
            '/rl',
            rateLimit([ipRule({ max: 1 })], {
              onLimited: (c, retryAfterSeconds) => c.redirect(`http://t/limited?after=${retryAfterSeconds}`, 302),
            }),
            (c) => c.text('ok'),
          );
        },
      ],
    });

    expect((await hit(fetch, '9.9.9.9')).status).toBe(200);
    const limited = await hit(fetch, '9.9.9.9');
    expect(limited.status).toBe(302);
    expect(limited.headers.get('location')).toMatch(/^http:\/\/t\/limited\?after=[1-9]\d*$/);
  });

  it('limits each client independently', async () => {
    const { fetch } = createTestApp({ mount: [mount([ipRule({ max: 1 })])] });

    expect((await hit(fetch, '2.2.2.2')).status).toBe(200);
    expect((await hit(fetch, '2.2.2.2')).status).toBe(429);
    expect((await hit(fetch, '3.3.3.3')).status).toBe(200);
  });

  it('AND-checks every rule so the strictest wins', async () => {
    const { fetch } = createTestApp({
      mount: [mount([ipRule({ max: 100 }), { scope: 'test:global', windowMs: 60_000, max: 1, key: () => 'all' }])],
    });

    expect((await hit(fetch, '4.4.4.4')).status).toBe(200);
    expect((await hit(fetch, '5.5.5.5')).status).toBe(429);
  });

  it('resolves a per-request max from a function', async () => {
    const { fetch } = createTestApp({
      mount: [mount([ipRule({ max: (c) => Number(c.req.header('x-max') ?? 1) })])],
    });

    expect((await hit(fetch, '7.7.7.7', { 'x-max': '2' })).status).toBe(200);
    expect((await hit(fetch, '7.7.7.7', { 'x-max': '2' })).status).toBe(200);
    expect((await hit(fetch, '7.7.7.7', { 'x-max': '2' })).status).toBe(429);
  });

  it('skips a rule whose key resolves to null', async () => {
    const { fetch } = createTestApp({
      mount: [mount([{ scope: 'test:na', windowMs: 60_000, max: 1, key: () => null }])],
    });

    expect((await hit(fetch, '6.6.6.6')).status).toBe(200);
    expect((await hit(fetch, '6.6.6.6')).status).toBe(200);
  });

  it('a spoofed left-most x-forwarded-for cannot mint a fresh bucket', async () => {
    const { fetch } = createTestApp({ mount: [mount([ipRule({ max: 1 })])] });

    expect((await hit(fetch, 'a.a.a.a, 8.8.8.8')).status).toBe(200);
    expect((await hit(fetch, 'b.b.b.b, 8.8.8.8')).status).toBe(429);
  });

  it('fails open when Redis is unavailable', async () => {
    const { fetch } = createTestApp({ mount: [mount([ipRule({ max: 1 })])] });
    const evalSpy = spyOn(getRedisClient(), 'eval').mockRejectedValue(new Error('redis down'));

    try {
      expect((await hit(fetch, '10.10.10.10')).status).toBe(200);
      expect((await hit(fetch, '10.10.10.10')).status).toBe(200);
    } finally {
      evalSpy.mockRestore();
    }
  });
});
