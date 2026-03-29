import { describe, expect, test } from 'bun:test';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type Fixture, VCR } from '@template/shared/vcr';

const FIXTURES_DIR = join(import.meta.dir, '..', '..', 'fixtures', 'acme');

describe('VCR — per-method capture (playback)', () => {
  test('returns body from queued fixture', async () => {
    const vcr = new VCR(FIXTURES_DIR);
    vcr.queue('message', 'default');
    const result = await vcr.capture('message', async () => ({ text: 'live' }));
    expect((result as { text: string }).text).toBe('Hello from Acme Corp.');
  });

  test('throws for error fixtures (status >= 400)', async () => {
    const vcr = new VCR(FIXTURES_DIR);
    vcr.queue('message', 'rateLimited');
    await expect(vcr.capture('message', async () => {})).rejects.toThrow();
  });

  test('consumes per-method queue in FIFO order', async () => {
    const vcr = new VCR(FIXTURES_DIR);
    vcr.queue('message', 'default');
    vcr.queue('message', 'default');
    const r1 = await vcr.capture('message', async () => ({ text: 'live' }));
    const r2 = await vcr.capture('message', async () => ({ text: 'live' }));
    expect((r1 as { text: string }).text).toBe('Hello from Acme Corp.');
    expect((r2 as { text: string }).text).toBe('Hello from Acme Corp.');
  });

  test('throws when no cassette queued for method', async () => {
    const vcr = new VCR(FIXTURES_DIR);
    await expect(vcr.capture('message', async () => ({}))).rejects.toThrow('VCR: no cassette queued for "message"');
  });

  test('isEmpty and clear', () => {
    const vcr = new VCR(FIXTURES_DIR);
    expect(vcr.isEmpty()).toBe(true);
    vcr.queue('message', 'default');
    expect(vcr.isEmpty()).toBe(false);
    vcr.clear();
    expect(vcr.isEmpty()).toBe(true);
  });
});

describe('VCR — captureResponse (full envelope)', () => {
  test('replays full fixture envelope with status and body', async () => {
    const vcr = new VCR(FIXTURES_DIR);
    vcr.queue('message', 'default');
    const result = await vcr.captureResponse('message', async () => ({
      status: 200,
      body: { text: 'live' },
    }));
    expect(result.status).toBe(200);
    expect((result.body as { text: string }).text).toBe('Hello from Acme Corp.');
  });

  test('returns error fixtures without throwing', async () => {
    const vcr = new VCR(FIXTURES_DIR);
    vcr.queue('message', 'rateLimited');
    const result = await vcr.captureResponse('message', async () => ({
      status: 200,
      body: {},
    }));
    expect(result.status).toBeGreaterThanOrEqual(400);
    expect(result.body).toBeDefined();
  });

  test('throws when no cassette queued', async () => {
    const vcr = new VCR(FIXTURES_DIR);
    await expect(vcr.captureResponse('message', async () => ({ status: 200, body: {} }))).rejects.toThrow(
      'VCR: no cassette queued for "message"',
    );
  });
});

describe('VCR — captureResponse record', () => {
  const tmpDir = join(tmpdir(), `vcr-response-test-${Date.now()}`);

  test('records status and headers from real fn', async () => {
    const vcr = new VCR(tmpDir);
    vcr.queue('withHeaders', 'test');
    const result = await vcr.captureResponse<{ id: string }>('withHeaders', async () => ({
      status: 201,
      body: { id: 'abc' },
      headers: { 'x-request-id': 'req-123', 'content-type': 'application/json' },
    }));
    expect(result.status).toBe(201);
    expect(result.body).toEqual({ id: 'abc' });
    expect(result.headers).toEqual({ 'x-request-id': 'req-123', 'content-type': 'application/json' });

    const saved = JSON.parse(readFileSync(join(tmpDir, 'withHeaders.test.json'), 'utf-8')) as Fixture<unknown>;
    expect(saved.status).toBe(201);
    expect(saved.headers).toEqual({ 'x-request-id': 'req-123', 'content-type': 'application/json' });
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('records non-200 status from real fn', async () => {
    const vcr = new VCR(tmpDir);
    vcr.queue('notFound', 'test');
    const result = await vcr.captureResponse<string>('notFound', async () => ({
      status: 404,
      body: 'Not Found',
    }));
    expect(result.status).toBe(404);
    expect(result.body).toBe('Not Found');
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('replays recorded headers from disk', async () => {
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(
      join(tmpDir, 'cached.test.json'),
      JSON.stringify({ status: 200, body: { ok: true }, headers: { etag: '"abc"' } }),
    );
    const vcr = new VCR(tmpDir);
    vcr.queue('cached', 'test');
    const result = await vcr.captureResponse<{ ok: boolean }>('cached', async () => {
      throw new Error('should not be called');
    });
    expect(result.headers).toEqual({ etag: '"abc"' });
    expect(result.body).toEqual({ ok: true });
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('sanitizes body but preserves status and headers', async () => {
    const vcr = new VCR(tmpDir, { sanitizeKeys: ['secret'] });
    vcr.queue('sanitized', 'test');
    const result = await vcr.captureResponse<{ id: string; secret: string }>('sanitized', async () => ({
      status: 200,
      body: { id: 'keep', secret: 'real-secret' },
      headers: { 'x-trace': 'trace-1' },
    }));
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ id: 'keep', secret: 'REDACTED' });
    expect(result.headers).toEqual({ 'x-trace': 'trace-1' });
    rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe('VCR — record', () => {
  const tmpDir = join(tmpdir(), `vcr-test-${Date.now()}`);

  test('calls real fn and saves fixture when file is missing', async () => {
    const vcr = new VCR(tmpDir);
    vcr.queue('liveCall', 'test');
    const result = await vcr.capture('liveCall', async () => ({ value: 'from real call' }));
    expect((result as { value: string }).value).toBe('from real call');
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('serves fixture from disk without calling real fn', async () => {
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(join(tmpDir, 'cached.test.json'), JSON.stringify({ status: 200, body: { cached: true } }));
    const vcr = new VCR(tmpDir);
    vcr.queue('cached', 'test');
    const result = await vcr.capture('cached', async () => {
      throw new Error('should not be called');
    });
    expect((result as { cached: boolean }).cached).toBe(true);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('sanitizes specified keys before saving', async () => {
    const vcr = new VCR(tmpDir, { sanitizeKeys: ['secret', 'nested.token'] });
    vcr.queue('withSecrets', 'test');
    const result = await vcr.capture('withSecrets', async () => ({
      id: 'keep',
      secret: 'real-secret',
      nested: { token: 'real-token' },
    }));
    expect((result as { secret: string }).secret).toBe('REDACTED');
    expect((result as { nested: { token: string } }).nested.token).toBe('REDACTED');
    expect((result as { id: string }).id).toBe('keep');
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('records raw JSON payloads without requiring an HTTP-shaped fixture body', async () => {
    const vcr = new VCR(tmpDir);
    const payload = [{ id: 'one' }, { id: 'two', nested: { ok: true } }];

    vcr.queue('rawPayload', 'test');
    const result = await vcr.capture('rawPayload', async () => payload);

    expect(result).toEqual(payload);
    expect(JSON.parse(readFileSync(join(tmpDir, 'rawPayload.test.json'), 'utf-8'))).toEqual({
      status: 200,
      body: payload,
    });

    rmSync(tmpDir, { recursive: true, force: true });
  });
});
