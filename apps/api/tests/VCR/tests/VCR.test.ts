import { rmSync, writeFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { VCR } from '@template/shared/vcr';

const FIXTURES_DIR = join(import.meta.dir, '..', '..', 'fixtures', 'acme');
const ERROR_FIXTURES_DIR = join(FIXTURES_DIR, 'errors');

describe('VCR — per-method capture (playback)', () => {
  test('returns body from queued fixture', async () => {
    const vcr = new VCR(FIXTURES_DIR);
    vcr.queue('message', 'default');
    const result = await vcr.capture('message', async () => ({ text: 'live' }));
    expect((result as { text: string }).text).toBe('Hello from Acme Corp.');
  });

  test('throws for error fixtures (status >= 400)', async () => {
    const vcr = new VCR(ERROR_FIXTURES_DIR);
    vcr.queue('rateLimited', 'default');
    await expect(vcr.capture('rateLimited', async () => {})).rejects.toThrow();
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
});
