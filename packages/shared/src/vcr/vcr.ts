/**
 * @atlas
 * @kind service
 * @partOf primitive:shared
 * @uses none
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { log } from '@template/shared/logger';
import { isTest } from '@template/shared/utils/env';

export type Fixture<T = unknown> = {
  version?: string;
  status: number;
  body?: T | null;
  bodyFile?: string;
  headers?: Record<string, string>;
};

type Sanitizer = {
  fn?: (s: string) => string;
  keys?: string[];
  isArray?: boolean;
  binaryExtension?: string;
};

type VersionFn = () => string | Promise<string>;

type VCROptions = {
  // Stable name for the upstream service — keys the static cache so all VCRs
  // wrapping the same service share one resolution. Global test setup pre-seeds
  // via VCR.setVersion(service, value).
  service: string;
  version: VersionFn;
  sanitizers?: Record<string, Sanitizer>;
};

export class VCR {
  // Shared across all instances. Mutate via static helpers; global test setup
  // can pre-populate so individual VCRs never pay the CLI/network cost.
  static versionCache = new Map<string, string>();

  static setVersion(service: string, value: string): void {
    VCR.versionCache.set(service, value);
  }

  static clearVersionCache(): void {
    VCR.versionCache.clear();
  }

  private readonly fixturesDir: string;
  private readonly sanitizers: Record<string, Sanitizer>;
  private readonly queues = new Map<string, string[]>();
  private readonly versionFn: VersionFn;
  private readonly service: string;

  constructor(fixturesDir: string, opts: VCROptions) {
    this.fixturesDir = fixturesDir;
    this.sanitizers = opts.sanitizers ?? {};
    this.versionFn = opts.version;
    this.service = opts.service;
  }

  queue(method: string, fixture: string): this {
    const q = this.queues.get(method) ?? [];
    q.push(fixture);
    this.queues.set(method, q);
    return this;
  }

  async capture<T>(method: string, realFn: () => Promise<T>): Promise<T> {
    if (!isTest) return realFn();
    const fixturePath = this.__popFixturePath(method);
    const current = await this.getVersion();

    if (existsSync(fixturePath)) {
      const saved = JSON.parse(readFileSync(fixturePath, 'utf-8')) as Fixture<T>;
      if (saved.version === current) {
        if (saved.status >= 400) {
          throw new Error(typeof saved.body === 'string' ? saved.body : JSON.stringify(saved.body));
        }
        if (saved.bodyFile) return readFileSync(join(dirname(fixturePath), saved.bodyFile)) as unknown as T;
        return saved.body as T;
      }
      log.warn(
        `VCR: refreshing cassette "${basename(fixturePath)}" (was ${saved.version ?? '<none>'}, now ${current})`,
      );
    }

    try {
      const raw = await realFn();
      const sanitized = this.__sanitize(method, raw);
      this.__saveFixture(fixturePath, method, sanitized, current, 200);
      return sanitized;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.__save(fixturePath, { version: current, status: 500, body: message });
      throw error;
    }
  }

  async captureResponse<T>(method: string, realFn: () => Promise<Fixture<T>>): Promise<Fixture<T>> {
    if (!isTest) return realFn();
    const fixturePath = this.__popFixturePath(method);
    const current = await this.getVersion();

    if (existsSync(fixturePath)) {
      const saved = JSON.parse(readFileSync(fixturePath, 'utf-8')) as Fixture<T>;
      if (saved.version === current) {
        const body = saved.bodyFile
          ? (readFileSync(join(dirname(fixturePath), saved.bodyFile)) as unknown as T)
          : (saved.body as T);
        return { status: saved.status, body, ...(saved.headers && { headers: saved.headers }) };
      }
      log.warn(
        `VCR: refreshing cassette "${basename(fixturePath)}" (was ${saved.version ?? '<none>'}, now ${current})`,
      );
    }

    try {
      const raw = await realFn();
      return this.__saveFixture<T>(
        fixturePath,
        method,
        this.__sanitize(method, raw.body) as T,
        current,
        raw.status,
        raw.headers,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.__save(fixturePath, { version: current, status: 500, body: message });
      throw error;
    }
  }

  // Public — capture/captureResponse drive through this internally; backfill
  // scripts and one-shot probes get the same cached resolution.
  async getVersion(): Promise<string> {
    const cached = VCR.versionCache.get(this.service);
    if (cached !== undefined) return cached;
    const resolved = await this.versionFn();
    if (!resolved) throw new Error(`VCR: version callback resolved to empty string (service=${this.service})`);
    VCR.versionCache.set(this.service, resolved);
    return resolved;
  }

  private __saveFixture<T>(
    fixturePath: string,
    method: string,
    body: T,
    version: string,
    status: number,
    headers?: Record<string, string>,
  ): Fixture<T> {
    if (body instanceof Uint8Array || body instanceof Buffer) {
      const ext = this.sanitizers[method]?.binaryExtension ?? '.bin';
      const baseName = basename(fixturePath, extname(fixturePath));
      const sidecarName = `${baseName}${ext}`;
      const sidecarPath = join(dirname(fixturePath), sidecarName);
      mkdirSync(dirname(sidecarPath), { recursive: true });
      writeFileSync(sidecarPath, body as Uint8Array);
      this.__save(fixturePath, { version, status, bodyFile: sidecarName, ...(headers && { headers }) });
      return { status, body: body as T, ...(headers && { headers }) };
    }
    this.__save(fixturePath, { version, status, body, ...(headers && { headers }) });
    return { status, body, ...(headers && { headers }) };
  }

  private __sanitize<T>(method: string, data: T): T {
    const rule = this.sanitizers[method];
    if (!rule) return data;
    if (data instanceof Uint8Array || data instanceof Buffer) return data;
    if (rule.isArray && Array.isArray(data)) {
      return data.map((item) => this.__applyRule(rule, item)) as unknown as T;
    }
    return this.__applyRule(rule, data);
  }

  private __applyRule<T>(rule: Sanitizer, data: T): T {
    if (rule.fn && typeof data === 'string') return rule.fn(data) as unknown as T;
    if (rule.keys?.length) return redactKeys(data, rule.keys);
    return data;
  }

  private __popFixturePath(method: string): string {
    const q = this.queues.get(method);
    const fixtureName = q?.shift();
    if (!fixtureName) throw new Error(`VCR: no cassette queued for "${method}"`);
    return join(this.fixturesDir, `${method}.${fixtureName}.json`);
  }

  private __save(fixturePath: string, data: unknown): void {
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
