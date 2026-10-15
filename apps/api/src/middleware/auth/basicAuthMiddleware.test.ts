import { describe, expect, it } from 'bun:test';
import { basicAuthMiddleware } from '#/middleware/auth/basicAuthMiddleware';
import { createTestApp } from '#tests/createTestApp';
import { get, jsonError } from '#tests/utils/request';

const { fetch } = createTestApp({
  mount: [
    (app) => {
      app.use('/guarded', basicAuthMiddleware('admin', 'pa:ss', 'Queues'));
      app.get('/guarded', (c) => c.json({ ok: true }));
    },
  ],
});

const basic = (credentials: string) => ({ Authorization: `Basic ${btoa(credentials)}` });

const expectChallenge = async (response: Response) => {
  expect(response.status).toBe(401);
  expect(response.headers.get('www-authenticate')).toBe('Basic realm="Queues"');
  const body = await jsonError(response);
  expect(body).toMatchObject({ error: 'AUTHENTICATION_FAILED', guidance: 'reauthenticate' });
  expect(body.requestId).toEqual(expect.any(String));
};

describe('basicAuthMiddleware', () => {
  it('challenges a request without credentials with the error envelope', async () => {
    await expectChallenge(await fetch(get('/guarded')));
  });

  it('challenges a wrong password', async () => {
    await expectChallenge(await fetch(get('/guarded', basic('admin:nope'))));
  });

  it('challenges a non-Basic scheme and undecodable credentials', async () => {
    await expectChallenge(await fetch(get('/guarded', { Authorization: 'Bearer abc' })));
    await expectChallenge(await fetch(get('/guarded', { Authorization: 'Basic %%%' })));
  });

  it('lets matching credentials through, colons in the password included', async () => {
    const response = await fetch(get('/guarded', basic('admin:pa:ss')));

    expect(response.status).toBe(200);
  });
});
