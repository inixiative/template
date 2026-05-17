import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { type Fixture, VCR } from './vcr';

describe('VCR', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'vcr-'));
    VCR.clearVersionCache();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  describe('capture', () => {
    it('captures real result, sanitizes, returns sanitized on first run', async () => {
      const vcr = new VCR(dir, {
        service: 'svc',
        version: () => '1.0.0',
        sanitizers: { fetch: { keys: ['secret'] } },
      }).queue('fetch', 'default');

      const result = await vcr.capture('fetch', async () => ({ secret: 'shh', visible: 'hi' }));

      expect(result).toEqual({ secret: 'REDACTED', visible: 'hi' });
      const saved = JSON.parse(readFileSync(join(dir, 'fetch.default.json'), 'utf-8')) as Fixture;
      expect(saved).toEqual({ version: '1.0.0', status: 200, body: { secret: 'REDACTED', visible: 'hi' } });
    });

    it('returns identical sanitized shape on replay as on capture', async () => {
      const realFn = mock(async () => ({ secret: 'shh', visible: 'hi' }));
      const opts = { service: 'svc', version: () => '1.0.0', sanitizers: { fetch: { keys: ['secret'] } } };

      const first = await new VCR(dir, opts).queue('fetch', 'default').capture('fetch', realFn);
      const second = await new VCR(dir, opts).queue('fetch', 'default').capture('fetch', realFn);

      expect(first).toEqual(second);
      expect(realFn).toHaveBeenCalledTimes(1);
    });

    it('refreshes cassette when version differs', async () => {
      const realFn = mock(async () => ({ value: 1 }));
      const v1 = new VCR(dir, { service: 'svc', version: () => '1.0.0' }).queue('fetch', 'default');
      await v1.capture('fetch', realFn);

      VCR.clearVersionCache();
      const realFn2 = mock(async () => ({ value: 2 }));
      const v2 = new VCR(dir, { service: 'svc', version: () => '2.0.0' }).queue('fetch', 'default');
      const result = await v2.capture('fetch', realFn2);

      expect(result).toEqual({ value: 2 });
      const saved = JSON.parse(readFileSync(join(dir, 'fetch.default.json'), 'utf-8')) as Fixture;
      expect(saved.version).toBe('2.0.0');
      expect(saved.body).toEqual({ value: 2 });
      expect(realFn2).toHaveBeenCalledTimes(1);
    });

    it('refreshes cassette with no version field (legacy)', async () => {
      writeFileSync(join(dir, 'fetch.default.json'), JSON.stringify({ status: 200, body: { stale: true } }));
      const realFn = mock(async () => ({ stale: false }));

      const result = await new VCR(dir, { service: 'svc', version: () => '1.0.0' })
        .queue('fetch', 'default')
        .capture('fetch', realFn);

      expect(result).toEqual({ stale: false });
      expect(realFn).toHaveBeenCalledTimes(1);
    });

    it('throws with body string on replayed error cassette', async () => {
      const failing = async () => {
        throw new Error('upstream 500');
      };
      const v1 = new VCR(dir, { service: 'svc', version: () => '1.0.0' }).queue('fetch', 'default');
      await expect(v1.capture('fetch', failing)).rejects.toThrow('upstream 500');

      const realFn = mock(async () => 'should-not-run');
      const v2 = new VCR(dir, { service: 'svc', version: () => '1.0.0' }).queue('fetch', 'default');
      await expect(v2.capture('fetch', realFn)).rejects.toThrow('upstream 500');
      expect(realFn).not.toHaveBeenCalled();
    });
  });

  describe('binary bodies', () => {
    it('writes a sidecar .bin file and reads it back as Buffer on replay', async () => {
      const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const v1 = new VCR(dir, { service: 'svc', version: () => '1.0.0' }).queue('download', 'png');
      const captured = await v1.capture('download', async () => bytes);

      expect(Buffer.isBuffer(captured)).toBe(true);
      const cassette = JSON.parse(readFileSync(join(dir, 'download.png.json'), 'utf-8')) as Fixture;
      expect(cassette.bodyFile).toBe('download.png.bin');
      expect(cassette.body).toBeUndefined();
      const sidecar = readFileSync(join(dir, 'download.png.bin'));
      expect(sidecar.equals(bytes)).toBe(true);

      const realFn = mock(async () => Buffer.from([0]));
      const v2 = new VCR(dir, { service: 'svc', version: () => '1.0.0' }).queue('download', 'png');
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
        sanitizers: { download: { binaryExtension: '.png' } },
      }).queue('download', 'icon');

      await vcr.capture('download', async () => bytes);

      const cassette = JSON.parse(readFileSync(join(dir, 'download.icon.json'), 'utf-8')) as Fixture;
      expect(cassette.bodyFile).toBe('download.icon.png');
      const sidecar = readFileSync(join(dir, 'download.icon.png'));
      expect(sidecar.equals(bytes)).toBe(true);
    });

    it('does not sanitize binary bodies (skips keys/fn rules)', async () => {
      const bytes = Buffer.from([1, 2, 3]);
      const vcr = new VCR(dir, {
        service: 'svc',
        version: () => '1.0.0',
        sanitizers: { download: { keys: ['anything'] } },
      }).queue('download', 'raw');

      const captured = await vcr.capture('download', async () => bytes);
      expect((captured as Buffer).equals(bytes)).toBe(true);
    });
  });

  describe('static version cache', () => {
    it('shares resolved version across VCR instances using the same service', async () => {
      const versionFn = mock(async () => '1.0.0');

      const v1 = new VCR(dir, { service: 'shared', version: versionFn }).queue('a', 'default');
      const v2 = new VCR(dir, { service: 'shared', version: versionFn }).queue('b', 'default');

      await v1.capture('a', async () => 1);
      await v2.capture('b', async () => 2);

      expect(versionFn).toHaveBeenCalledTimes(1);
    });

    it('different services do not share cache', async () => {
      const aFn = mock(async () => 'a-v1');
      const bFn = mock(async () => 'b-v1');

      await new VCR(dir, { service: 'a', version: aFn }).queue('x', 'default').capture('x', async () => 1);
      await new VCR(dir, { service: 'b', version: bFn }).queue('y', 'default').capture('y', async () => 1);

      expect(aFn).toHaveBeenCalledTimes(1);
      expect(bFn).toHaveBeenCalledTimes(1);
    });

    it('VCR.setVersion pre-seeds the cache so versionFn is never called', async () => {
      VCR.setVersion('preseeded', 'forced-1.0');
      const versionFn = mock(async () => 'real-2.0');

      await new VCR(dir, { service: 'preseeded', version: versionFn })
        .queue('a', 'default')
        .capture('a', async () => 1);

      expect(versionFn).not.toHaveBeenCalled();
      const saved = JSON.parse(readFileSync(join(dir, 'a.default.json'), 'utf-8')) as Fixture;
      expect(saved.version).toBe('forced-1.0');
    });

    it('VCR.clearVersionCache forces re-resolution', async () => {
      const versionFn = mock(async () => '1.0.0');
      const opts = { service: 'svc', version: versionFn };

      await new VCR(dir, opts).queue('a', 'default').capture('a', async () => 1);
      VCR.clearVersionCache();
      await new VCR(dir, opts).queue('a', 'default').capture('a', async () => 1);

      expect(versionFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('queue mechanics', () => {
    it('consumes per-method queue in FIFO order', async () => {
      const vcr = new VCR(dir, { service: 'svc', version: () => '1.0.0' });
      vcr.queue('m', 'first');
      vcr.queue('m', 'second');

      await vcr.capture('m', async () => 1);
      await vcr.capture('m', async () => 2);

      expect(existsSync(join(dir, 'm.first.json'))).toBe(true);
      expect(existsSync(join(dir, 'm.second.json'))).toBe(true);
    });

    it('throws when no cassette queued for a method', async () => {
      const vcr = new VCR(dir, { service: 'svc', version: () => '1.0.0' });
      await expect(vcr.capture('unqueued', async () => 1)).rejects.toThrow('VCR: no cassette queued for "unqueued"');
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

  describe('captureResponse', () => {
    it('preserves status/headers + sanitizes body the same on capture and replay', async () => {
      const opts = { service: 'svc', version: () => '1.0.0', sanitizers: { fetch: { keys: ['token'] } } };
      const headers = { 'x-rate-limit': '99' };

      const realFn = mock(async () => ({ status: 201, body: { token: 'shh', id: 'abc' }, headers }));
      const first = await new VCR(dir, opts).queue('fetch', 'default').captureResponse('fetch', realFn);

      expect(first.status).toBe(201);
      expect(first.headers).toEqual(headers);
      expect(first.body).toEqual({ token: 'REDACTED', id: 'abc' });

      const second = await new VCR(dir, opts).queue('fetch', 'default').captureResponse('fetch', realFn);
      expect(second).toEqual(first);
      expect(realFn).toHaveBeenCalledTimes(1);
    });
  });
});
