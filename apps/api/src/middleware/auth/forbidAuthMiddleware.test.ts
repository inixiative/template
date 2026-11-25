import { describe, expect, it } from 'bun:test';
import type { RouteForbid } from '#/lib/routeTemplates/types';
import { makeForbidMiddleware } from '#/middleware/auth/forbidAuthMiddleware';
import { createTestApp } from '#tests/createTestApp';

const makeTestApp = (
  forbid: RouteForbid,
  setup: (c: { set: (key: string, value: unknown) => void }) => void,
) =>
  createTestApp({
    mount: [
      (app) => {
        app.use('*', async (c, next) => {
          c.set('user', null);
          c.set('token', null);
          c.set('spoofedBy', null);
          c.set('txn', undefined);
          setup(c as unknown as { set: (key: string, value: unknown) => void });
          await next();
        });
        app.post('/test', makeForbidMiddleware(forbid), (c) => c.json({ ok: true }));
      },
    ],
  });

describe('makeForbidMiddleware', () => {
  it('rejects API tokens when forbid.tokens is true, even for superadmin tokens or spoofed token sessions', async () => {
    const { app } = await makeTestApp({ tokens: true }, (c) => {
      c.set('token', { id: 'tok_1', user: { id: 'usr_1', platformRole: 'superadmin' } });
      c.set('authCredentialKind', 'token');
    });
    const res = await app.request('/test', { method: 'POST' });
    expect(res.status).toBe(403);

    // spoofMiddleware clears c.get('token') after spoofing; authCredentialKind still catches it
    const { app: spoofedTokenApp } = await makeTestApp({ tokens: true }, (c) => {
      c.set('user', { id: 'usr_target' });
      c.set('spoofedBy', { id: 'usr_admin', platformRole: 'superadmin' });
      c.set('authCredentialKind', 'token');
    });
    expect((await spoofedTokenApp.request('/test', { method: 'POST' })).status).toBe(403);

    const { app: forbidJwtOnSpoofedTokenApp } = await makeTestApp({ jwt: true }, (c) => {
      c.set('user', { id: 'usr_target' });
      c.set('spoofedBy', { id: 'usr_admin', platformRole: 'superadmin' });
      c.set('authCredentialKind', 'token');
    });
    expect((await forbidJwtOnSpoofedTokenApp.request('/test', { method: 'POST' })).status).toBe(
      200,
    );
  });

  it('rejects user JWT sessions when forbid.jwt is true, but allows API tokens', async () => {
    const { app: jwtApp } = await makeTestApp({ jwt: true }, (c) => {
      c.set('user', { id: 'usr_1', platformRole: 'superadmin' });
    });
    expect((await jwtApp.request('/test', { method: 'POST' })).status).toBe(403);

    const { app: tokenApp } = await makeTestApp({ jwt: true }, (c) => {
      c.set('token', { id: 'tok_1' });
    });
    expect((await tokenApp.request('/test', { method: 'POST' })).status).toBe(200);
  });

  it('rejects spoofed sessions when forbid.spoof is true', async () => {
    const { app } = await makeTestApp({ spoof: true }, (c) => {
      c.set('user', { id: 'usr_target' });
      c.set('spoofedBy', { id: 'usr_admin', platformRole: 'superadmin' });
    });
    const res = await app.request('/test', { method: 'POST' });
    expect(res.status).toBe(403);
  });

  it('rejects registered batch sub-requests when forbid.batch is true', async () => {
    const { app } = await makeTestApp({ batch: true }, (c) => {
      c.set('txn', {});
    });
    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'x-batch-id': 'batch_1' },
    });
    expect(res.status).toBe(400);
  });

  it('accumulates all violated forbid rules into one response', async () => {
    const { app } = await makeTestApp({ tokens: true, spoof: true, batch: true }, (c) => {
      c.set('user', { id: 'usr_target' });
      c.set('spoofedBy', { id: 'usr_admin', platformRole: 'superadmin' });
      c.set('authCredentialKind', 'token');
      c.set('txn', {});
    });
    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'x-batch-id': 'batch_1' },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as {
      message: string;
      details: Array<{ code: string; rule: string; message: string }>;
    };
    expect(body.details.map((entry) => entry.rule)).toEqual(['batch', 'tokens', 'spoof']);
    expect(body.message).toContain('batch');
    expect(body.message).toContain('API tokens');
    expect(body.message).toContain('spoofing');
  });
});
