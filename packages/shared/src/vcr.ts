import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const redactValue = (value: unknown): unknown => {
  if (value === null || value === undefined) return value;
  if (typeof value === 'object') return value;
  return 'REDACTED';
};

const sanitizePath = (obj: unknown, parts: string[]): void => {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    for (const item of obj) sanitizePath(item, parts);
    return;
  }
  const record = obj as Record<string, unknown>;
  const [head, ...rest] = parts;
  if (rest.length === 0) {
    if (head in record) record[head] = redactValue(record[head]);
  } else {
    sanitizePath(record[head], rest);
  }
};

const sanitize = <T>(data: T, keys: string[]): T => {
  if (!keys.length) return data;
  const clone = JSON.parse(JSON.stringify(data)) as T;
  for (const key of keys) sanitizePath(clone, key.split('.'));
  return clone;
};

export type Fixture<T = unknown> = {
  status: number;
  body: T | null;
  headers?: Record<string, string>;
};

/**
 * VCR — per-method cassette-style fixture playback and capture.
 *
 * Each method has its own FIFO queue. Queue named fixtures before each test.
 * In test mode, provider methods call `.capture(method, realFn)` to serve from
 * disk or record a real call when the fixture is missing.
 *
 * @example
 * // In tests — queue per method
 * planetscaleApi.vcr.queue('getDatabase', 'success');
 * planetscaleApi.vcr.queue('getBranch', 'staging');
 *
 * // In provider class — record on miss
 * async getDatabase(org: string, db: string): Promise<PlanetScaleDatabase> {
 *   if (process.env.NODE_ENV !== 'test') return this._getDatabase(org, db);
 *   return this.vcr.capture('getDatabase', () => this._getDatabase(org, db));
 * }
 */
export class VCR {
  private readonly fixturesDir: string;
  private readonly sanitizeKeys: string[];
  private readonly queues = new Map<string, string[]>();

  constructor(fixturesDir: string, options: { sanitizeKeys?: string[] } = {}) {
    this.fixturesDir = fixturesDir;
    this.sanitizeKeys = options.sanitizeKeys ?? [];
  }

  /** Queue a fixture for a specific method. Consumed in FIFO order per method. */
  queue(method: string, fixture: string): this {
    const q = this.queues.get(method) ?? [];
    q.push(fixture);
    this.queues.set(method, q);
    return this;
  }

  /**
   * Capture mode — serve from disk if fixture exists, otherwise call real fn,
   * sanitize, save to disk, and return. Returns T directly (same shape as real fn).
   *
   * Error handling:
   * - Fixture with status >= 400: throws Error(body)
   * - Real fn throws: saves { status: 500, body: message } and rethrows
   */
  async capture<T>(method: string, realFn: () => Promise<T>): Promise<T> {
    const q = this.queues.get(method);
    const fixtureName = q?.shift();
    if (!fixtureName) throw new Error(`VCR: no cassette queued for "${method}"`);

    const fixturePath = join(this.fixturesDir, `${method}.${fixtureName}.json`);

    if (existsSync(fixturePath)) {
      const saved = JSON.parse(readFileSync(fixturePath, 'utf-8')) as Fixture<T>;
      if (saved.status >= 400) throw new Error(String(saved.body));
      return saved.body as T;
    }

    try {
      const raw = await realFn();
      const saved: Fixture<T> = { status: 200, body: sanitize(raw, this.sanitizeKeys) };
      mkdirSync(dirname(fixturePath), { recursive: true });
      writeFileSync(fixturePath, `${JSON.stringify(saved, null, 2)}\n`);
      return saved.body as T;
    } catch (error) {
      const saved: Fixture<string> = {
        status: 500,
        body: error instanceof Error ? error.message : String(error),
      };
      mkdirSync(dirname(fixturePath), { recursive: true });
      writeFileSync(fixturePath, `${JSON.stringify(saved, null, 2)}\n`);
      throw error;
    }
  }

  isEmpty(): boolean {
    for (const q of this.queues.values()) {
      if (q.length > 0) return false;
    }
    return true;
  }

  clear(): void {
    this.queues.clear();
  }
}
