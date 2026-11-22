import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assertScrubbed,
  createScrubber,
  createVcrFetch,
  createVcrRecorder,
  isVcrError,
  resetDefaultVcrSession,
  VCR,
  type VcrCassette,
} from '@template/shared/vcr';

describe('VCR', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'vcr-'));
    resetDefaultVcrSession();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    resetDefaultVcrSession();
  });

  describe('capture', () => {
    it('fails closed in default replay mode when cassette is missing', async () => {
      const realFn = mock(async () => ({ visible: 'hi' }));
      const vcr = new VCR(dir, {
        service: 'svc',
        version: () => '1.0.0',
        modeEnvVar: '__VCR_TEST_UNSET_MODE__',
      }).queue('fetch', 'absent');

      await expect(vcr.capture('fetch', realFn)).rejects.toThrow('cassette "fetch.absent.json"');
      expect(realFn).not.toHaveBeenCalled();
    });

    it('captures real result, sanitizes, and writes cassette on first run in auto mode', async () => {
      const vcr = new VCR(dir, {
        service: 'svc',
        version: () => '1.0.0',
        mode: 'auto',
        sanitizers: { fetch: { keys: ['secret'] } },
      }).queue('fetch', 'default');

      const result = await vcr.capture('fetch', async () => ({ secret: 'shh', visible: 'hi' }));

      expect(result).toEqual({ secret: '<REDACTED:SECRET>', visible: 'hi' });
      const saved = JSON.parse(
        readFileSync(join(dir, 'fetch.default.json'), 'utf-8'),
      ) as VcrCassette;
      expect(saved.version).toBe('1.0.0');
      expect(saved.status).toBe(200);
      expect(saved.body).toEqual({ secret: '<REDACTED:SECRET>', visible: 'hi' });
      expect(saved.recorded?.service).toBe('svc');
    });

    it('returns identical sanitized shape on replay as on capture', async () => {
      const realFn = mock(async () => ({ secret: 'shh', visible: 'hi' }));
      const opts = {
        service: 'svc',
        version: () => '1.0.0',
        mode: 'auto' as const,
        sanitizers: { fetch: { keys: ['secret'] } },
      };

      const first = await new VCR(dir, opts).queue('fetch', 'default').capture('fetch', realFn);
      const second = await new VCR(dir, opts).queue('fetch', 'default').capture('fetch', realFn);

      expect(first).toEqual(second);
      expect(realFn).toHaveBeenCalledTimes(1);
    });

    it('refreshes cassette in record mode when structure matches, and holds back drift to .pending.json', async () => {
      const v1 = new VCR(dir, { service: 'svc', version: () => '1.0.0', mode: 'auto' }).queue(
        'fetch',
        'default',
      );
      await v1.capture('fetch', async () => ({ value: 1 }));

      VCR.clearVersionCache();
      const v2 = new VCR(dir, { service: 'svc', version: () => '2.0.0', mode: 'record' }).queue(
        'fetch',
        'default',
      );
      const refreshed = await v2.capture('fetch', async () => ({ value: 2 }));
      expect(refreshed).toEqual({ value: 2 });
      const saved = JSON.parse(
        readFileSync(join(dir, 'fetch.default.json'), 'utf-8'),
      ) as VcrCassette;
      expect(saved.version).toBe('2.0.0');
      expect(saved.body).toEqual({ value: 2 });

      VCR.clearVersionCache();
      const v3 = new VCR(dir, { service: 'svc', version: () => '3.0.0', mode: 'record' }).queue(
        'fetch',
        'default',
      );
      await v3.capture('fetch', async () => ({ value: 3, extraField: true }));
      expect(existsSync(join(dir, 'fetch.default.pending.json'))).toBe(true);
      const committedAfterDrift = JSON.parse(
        readFileSync(join(dir, 'fetch.default.json'), 'utf-8'),
      ) as VcrCassette;
      expect(committedAfterDrift.version).toBe('2.0.0');
    });

    it('throws with body string on replayed error cassette', async () => {
      const failing = async () => {
        throw new Error('upstream 500');
      };
      const v1 = new VCR(dir, { service: 'svc', version: () => '1.0.0', mode: 'auto' }).queue(
        'fetch',
        'default',
      );
      await expect(v1.capture('fetch', failing)).rejects.toThrow('upstream 500');

      const realFn = mock(async () => 'should-not-run');
      const v2 = new VCR(dir, { service: 'svc', version: () => '1.0.0', mode: 'replay' }).queue(
        'fetch',
        'default',
      );
      await expect(v2.capture('fetch', realFn)).rejects.toThrow('upstream 500');
      expect(realFn).not.toHaveBeenCalled();
    });
  });

  describe('binary bodies', () => {
    it('writes a sidecar .bin file and reads it back as Buffer on replay', async () => {
      const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const v1 = new VCR(dir, { service: 'svc', version: () => '1.0.0', mode: 'auto' }).queue(
        'download',
        'png',
      );
      const captured = await v1.capture('download', async () => bytes);

      expect(Buffer.isBuffer(captured)).toBe(true);
      const cassette = JSON.parse(
        readFileSync(join(dir, 'download.png.json'), 'utf-8'),
      ) as VcrCassette;
      expect(cassette.bodyFile).toBe('download.png.bin');
      expect(cassette.body).toBeUndefined();
      const sidecar = readFileSync(join(dir, 'download.png.bin'));
      expect(sidecar.equals(bytes)).toBe(true);

      const realFn = mock(async () => Buffer.from([0]));
      const v2 = new VCR(dir, { service: 'svc', version: () => '1.0.0', mode: 'replay' }).queue(
        'download',
        'png',
      );
      const replayed = await v2.capture('download', realFn);
      expect(Buffer.isBuffer(replayed)).toBe(true);
      expect((replayed as Buffer).equals(bytes)).toBe(true);
      expect(realFn).not.toHaveBeenCalled();
    });

    it('honors per-method binaryExtension override', async () => {
      const bytes = Buffer.from('hello');
      const vcr = new VCR(dir, {
        service: 'svc',
        version: () => '1.0.0',
        mode: 'auto',
        sanitizers: { download: { binaryExtension: '.png' } },
      }).queue('download', 'icon');

      await vcr.capture('download', async () => bytes);

      const cassette = JSON.parse(
        readFileSync(join(dir, 'download.icon.json'), 'utf-8'),
      ) as VcrCassette;
      expect(cassette.bodyFile).toBe('download.icon.png');
      const sidecar = readFileSync(join(dir, 'download.icon.png'));
      expect(sidecar.equals(bytes)).toBe(true);
    });

    it('does not sanitize binary bodies (skips keys/transform rules)', async () => {
      const bytes = Buffer.from([1, 2, 3]);
      const vcr = new VCR(dir, {
        service: 'svc',
        version: () => '1.0.0',
        mode: 'auto',
        sanitizers: { download: { keys: ['anything'] } },
      }).queue('download', 'raw');

      const captured = await vcr.capture('download', async () => bytes);
      expect((captured as Buffer).equals(bytes)).toBe(true);
    });
  });

  describe('static version cache', () => {
    it('shares resolved version across VCR instances using the same service', async () => {
      const versionFn = mock(async () => '1.0.0');

      const v1 = new VCR(dir, { service: 'shared', version: versionFn, mode: 'auto' }).queue(
        'a',
        'default',
      );
      const v2 = new VCR(dir, { service: 'shared', version: versionFn, mode: 'auto' }).queue(
        'b',
        'default',
      );

      await v1.capture('a', async () => 1);
      await v2.capture('b', async () => 2);

      expect(versionFn).toHaveBeenCalledTimes(1);
    });

    it('different services do not share cache', async () => {
      const aFn = mock(async () => 'a-v1');
      const bFn = mock(async () => 'b-v1');

      await new VCR(dir, { service: 'a', version: aFn, mode: 'auto' })
        .queue('x', 'default')
        .capture('x', async () => 1);
      await new VCR(dir, { service: 'b', version: bFn, mode: 'auto' })
        .queue('y', 'default')
        .capture('y', async () => 1);

      expect(aFn).toHaveBeenCalledTimes(1);
      expect(bFn).toHaveBeenCalledTimes(1);
    });

    it('VCR.setVersion pre-seeds the cache so versionFn is never called', async () => {
      VCR.setVersion('preseeded', 'forced-1.0');
      const versionFn = mock(async () => 'real-2.0');

      await new VCR(dir, { service: 'preseeded', version: versionFn, mode: 'auto' })
        .queue('a', 'default')
        .capture('a', async () => 1);

      expect(versionFn).not.toHaveBeenCalled();
      const saved = JSON.parse(readFileSync(join(dir, 'a.default.json'), 'utf-8')) as VcrCassette;
      expect(saved.version).toBe('forced-1.0');
    });

    it('VCR.clearVersionCache forces re-resolution', async () => {
      const versionFn = mock(async () => '1.0.0');
      const opts = { service: 'svc', version: versionFn, mode: 'record' as const };

      await new VCR(dir, opts).queue('a', 'default').capture('a', async () => 1);
      VCR.clearVersionCache();
      await new VCR(dir, opts).queue('a', 'default').capture('a', async () => 1);

      expect(versionFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('queue mechanics', () => {
    it('consumes per-method queue in FIFO order', async () => {
      const vcr = new VCR(dir, { service: 'svc', version: () => '1.0.0', mode: 'auto' });
      vcr.queue('m', 'first');
      vcr.queue('m', 'second');

      await vcr.capture('m', async () => 1);
      await vcr.capture('m', async () => 2);

      expect(existsSync(join(dir, 'm.first.json'))).toBe(true);
      expect(existsSync(join(dir, 'm.second.json'))).toBe(true);
    });

    it('throws when no cassette queued for a method', async () => {
      const vcr = new VCR(dir, { service: 'svc', version: () => '1.0.0' });
      await expect(vcr.capture('unqueued', async () => 1)).rejects.toThrow(
        'VCR: no cassette queued for "unqueued"',
      );
    });

    it('isEmpty + clear track queue state', () => {
      const vcr = new VCR(dir, { service: 'svc', version: () => '1.0.0' });
      expect(vcr.isEmpty()).toBe(true);
      vcr.queue('m', 'default');
      expect(vcr.isEmpty()).toBe(false);
      vcr.clear();
      expect(vcr.isEmpty()).toBe(true);
    });
  });

  describe('structured sanitizers', () => {
    it('applies a structured transform before fixed-key masking', async () => {
      const vcr = new VCR(dir, {
        service: 'svc',
        version: () => '1.0.0',
        mode: 'auto',
        sanitizers: {
          fetch: {
            transform: (body: unknown) => ({
              ...(body as Record<string, unknown>),
              transformed: true,
            }),
            keys: ['secret'],
          },
        },
      }).queue('fetch', 'structured');

      const response = await vcr.captureResponse<Record<string, unknown>>('fetch', async () => ({
        status: 200,
        body: { visible: 'kept', secret: 'sensitive' },
      }));

      expect(response.body).toEqual({
        visible: 'kept',
        secret: '<REDACTED:SECRET>',
        transformed: true,
      });
    });

    it('applies transform to non-string capture results and to each item of an isArray rule', async () => {
      const vcr = new VCR(dir, {
        service: 'svc',
        version: () => '1.0.0',
        mode: 'auto',
        sanitizers: {
          list: {
            isArray: true,
            transform: (item: unknown) => ({ ...(item as Record<string, unknown>), seen: true }),
          },
        },
      }).queue('list', 'default');

      const result = await vcr.capture<Array<Record<string, unknown>>>('list', async () => [
        { id: 1 },
        { id: 2 },
      ]);

      expect(result).toEqual([
        { id: 1, seen: true },
        { id: 2, seen: true },
      ]);
    });
  });

  describe('captureResponse', () => {
    it('preserves status/headers + sanitizes body and secret headers identically on capture and replay', async () => {
      const opts = {
        service: 'svc',
        version: () => '1.0.0',
        mode: 'auto' as const,
        sanitizers: { fetch: { keys: ['token'] } },
      };

      const realFn = mock(async () => ({
        status: 201,
        body: { token: 'shh', id: 'abc' },
        headers: { 'x-rate-limit': '99', 'set-cookie': 'session=secret-cookie-value' },
      }));
      const first = await new VCR(dir, opts)
        .queue('fetch', 'default')
        .captureResponse('fetch', realFn);

      expect(first.status).toBe(201);
      expect(first.headers).toEqual({
        'x-rate-limit': '99',
        'set-cookie': '<REDACTED:HEADER_SECRET>',
      });
      expect(first.body).toEqual({ token: '<REDACTED:SECRET>', id: 'abc' });

      const second = await new VCR(dir, opts)
        .queue('fetch', 'default')
        .captureResponse('fetch', realFn);
      expect(second).toEqual(first);
      expect(realFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('HTTP VCR via @inixiative/vcr', () => {
    const templateScopedToken = `prod_user_${'a1b2c3d4'.repeat(6)}`;

    it('records and replays HTTP calls while scrubbing template tokens, secret headers, query params, and emails', async () => {
      const liveFetch = mock(async () =>
        Response.json(
          {
            ok: true,
            email: 'alice@example.com',
            issuedToken: templateScopedToken,
          },
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

      const recorder = createVcrRecorder(dir, {
        service: 'billing-provider',
        version: '2026-01-01',
        mode: 'auto',
        scrubber: createScrubber({ knownSecrets: ['my-custom-template-secret'] }),
      }).queue('charge', 'create');

      const recordFetch = createVcrFetch(recorder, 'charge', {
        fetchImpl: liveFetch as unknown as typeof fetch,
      });

      const recordedRes = await recordFetch(
        'https://api.provider.test/v1/charges?api_key=raw-query-secret&limit=10',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${templateScopedToken}`,
            'X-Api-Key': 'my-custom-template-secret',
            Cookie: 'sid=super-secret-session',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ amount: 500, customerEmail: 'alice@example.com' }),
        },
      );

      expect(recordedRes.status).toBe(200);
      expect(liveFetch).toHaveBeenCalledTimes(1);

      const rawCassetteText = readFileSync(join(dir, 'charge.create.json'), 'utf-8');
      expect(rawCassetteText).not.toContain(templateScopedToken);
      expect(rawCassetteText).not.toContain('my-custom-template-secret');
      expect(rawCassetteText).not.toContain('raw-query-secret');
      expect(rawCassetteText).not.toContain('super-secret-session');
      expect(rawCassetteText).not.toContain('alice@example.com');
      expect(() => assertScrubbed(JSON.parse(rawCassetteText))).not.toThrow();

      const replayRecorder = createVcrRecorder(dir, {
        service: 'billing-provider',
        version: '2026-01-01',
        mode: 'replay',
      }).queue('charge', 'create');

      const replayFetch = createVcrFetch(replayRecorder, 'charge', {
        fetchImpl: liveFetch as unknown as typeof fetch,
      });

      const replayedRes = await replayFetch(
        'https://api.provider.test/v1/charges?api_key=different-secret&limit=10',
        {
          method: 'POST',
          headers: { Authorization: 'Bearer other-token' },
        },
      );

      expect(replayedRes.status).toBe(200);
      expect(await replayedRes.json()).toEqual({
        ok: true,
        email: 'redacted@example.invalid',
        issuedToken: '<REDACTED:API_TOKEN>',
      });
      expect(liveFetch).toHaveBeenCalledTimes(1);
    });

    it('throws VcrError(request_mismatch) when replayed HTTP method, path, or body diverges', async () => {
      const liveFetch = mock(async () =>
        Response.json(
          { created: true },
          { status: 201, headers: { 'content-type': 'application/json' } },
        ),
      );

      const recordRecorder = createVcrRecorder(dir, {
        service: 'provider',
        version: '1.0.0',
        mode: 'auto',
      }).queue('sync', 'item');

      await createVcrFetch(recordRecorder, 'sync', {
        fetchImpl: liveFetch as unknown as typeof fetch,
      })('https://api.provider.test/v1/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku: 'abc' }),
      });

      const pathMismatchRecorder = createVcrRecorder(dir, {
        service: 'provider',
        version: '1.0.0',
        mode: 'replay',
      }).queue('sync', 'item');

      let pathErr: unknown;
      try {
        await createVcrFetch(pathMismatchRecorder, 'sync')(
          'https://api.provider.test/v1/other-endpoint',
          { method: 'POST' },
        );
      } catch (error) {
        pathErr = error;
      }
      expect(isVcrError(pathErr, 'request_mismatch')).toBe(true);

      const bodyMismatchRecorder = createVcrRecorder(dir, {
        service: 'provider',
        version: '1.0.0',
        mode: 'replay',
      }).queue('sync', 'item');

      let bodyErr: unknown;
      try {
        await createVcrFetch(bodyMismatchRecorder, 'sync', { matchBody: true })(
          'https://api.provider.test/v1/items',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sku: 'different' }),
          },
        );
      } catch (error) {
        bodyErr = error;
      }
      expect(isVcrError(bodyErr, 'request_mismatch')).toBe(true);
    });
  });
});
