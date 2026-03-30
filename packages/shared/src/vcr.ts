import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type Fixture<T = unknown> = {
  status: number;
  body: T | null;
  headers?: Record<string, string>;
};

/**
 * Per-method sanitizer applied during recording.
 * - `fn`:      string transform for string bodies
 * - `keys`:    dot-path redaction for object bodies (e.g. ['plain_text', 'actor.display_name'])
 * - `isArray`: body is an array — apply fn/keys to each element
 */
type Sanitizer = {
  fn?: (s: string) => string;
  keys?: string[];
  isArray?: boolean;
};

/**
 * VCR — per-method cassette-style fixture playback and capture.
 *
 * @example
 * const vcr = new VCR(fixturesDir, {
 *   getSecret:       { fn: (s) => s.replace(/rw_Fe26\S+/g, 'REDACTED') },
 *   getDatabase:     { keys: ['plain_text', 'username'] },
 *   listWorkspaces:  { keys: ['token'], isArray: true },
 * });
 */
export class VCR {
  private readonly fixturesDir: string;
  private readonly sanitizers: Record<string, Sanitizer>;
  private readonly queues = new Map<string, string[]>();

  constructor(fixturesDir: string, sanitizers: Record<string, Sanitizer> = {}) {
    this.fixturesDir = fixturesDir;
    this.sanitizers = sanitizers;
  }

  /** Queue a fixture for a specific method. Consumed in FIFO order per method. */
  queue(method: string, fixture: string): this {
    const q = this.queues.get(method) ?? [];
    q.push(fixture);
    this.queues.set(method, q);
    return this;
  }

  /**
   * Serve from disk if fixture exists, otherwise call real fn, sanitize, save, return.
   * - Fixture with status >= 400 → throws Error(body)
   * - Real fn throws → saves { status: 500, body: message } and rethrows
   */
  async capture<T>(method: string, realFn: () => Promise<T>): Promise<T> {
    const fixturePath = this._popFixturePath(method);

    if (existsSync(fixturePath)) {
      const saved = JSON.parse(readFileSync(fixturePath, 'utf-8')) as Fixture<T>;
      if (saved.status >= 400) throw new Error(String(saved.body));
      return saved.body as T;
    }

    try {
      const raw = await realFn();
      const saved: Fixture<T> = { status: 200, body: this._sanitize(method, raw) };
      this._save(fixturePath, saved);
      return saved.body as T;
    } catch (error) {
      this._save(fixturePath, { status: 500, body: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Like capture but for response-shaped calls — realFn returns the full Fixture
   * envelope (status, body, headers). Does NOT throw on error status.
   */
  async captureResponse<T>(method: string, realFn: () => Promise<Fixture<T>>): Promise<Fixture<T>> {
    const fixturePath = this._popFixturePath(method);

    if (existsSync(fixturePath)) {
      return JSON.parse(readFileSync(fixturePath, 'utf-8')) as Fixture<T>;
    }

    try {
      const raw = await realFn();
      const saved: Fixture<T> = {
        status: raw.status,
        body: this._sanitize(method, raw.body) as T | null,
        ...(raw.headers && { headers: raw.headers }),
      };
      this._save(fixturePath, saved);
      return saved;
    } catch (error) {
      this._save(fixturePath, { status: 500, body: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  private _sanitize<T>(method: string, data: T): T {
    const rule = this.sanitizers[method];
    if (!rule) return data;

    if (rule.isArray && Array.isArray(data)) {
      return data.map((item) => this._applyRule(rule, item)) as unknown as T;
    }

    return this._applyRule(rule, data);
  }

  private _applyRule<T>(rule: Sanitizer, data: T): T {
    if (rule.fn && typeof data === 'string') return rule.fn(data) as unknown as T;
    if (rule.keys?.length) return redactKeys(data, rule.keys);
    return data;
  }

  private _popFixturePath(method: string): string {
    const q = this.queues.get(method);
    const fixtureName = q?.shift();
    if (!fixtureName) throw new Error(`VCR: no cassette queued for "${method}"`);
    return join(this.fixturesDir, `${method}.${fixtureName}.json`);
  }

  private _save(fixturePath: string, data: unknown): void {
    mkdirSync(dirname(fixturePath), { recursive: true });
    writeFileSync(fixturePath, `${JSON.stringify(data, null, 2)}\n`);
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

/** Redact dot-path keys to 'REDACTED'. */
const redactKeys = <T>(data: T, keys: string[]): T => {
  if (!keys.length) return data;
  const clone = JSON.parse(JSON.stringify(data)) as T;
  for (const key of keys) redactPath(clone, key.split('.'));
  return clone;
};

const redactPath = (obj: unknown, parts: string[]): void => {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    for (const item of obj) redactPath(item, parts);
    return;
  }
  const record = obj as Record<string, unknown>;
  const [head, ...rest] = parts;
  if (rest.length === 0) {
    if (head in record) {
      const v = record[head];
      record[head] = v === null || v === undefined || typeof v === 'object' ? v : 'REDACTED';
    }
  } else {
    redactPath(record[head], rest);
  }
};
