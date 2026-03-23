import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { redact } from './sanitize';

const FIXTURES_DIR = join(import.meta.dir, '..', 'fixtures');

/**
 * HTTP-style fixture — mirrors what a real HTTP response looks like.
 * The caller (mock API client) decides whether to throw based on status,
 * exactly as the real client would.
 */
export type Fixture<T = unknown> = {
  status: number;
  body: T | null;
  headers?: Record<string, string>;
};

/**
 * VCR — file-based HTTP fixture manager.
 *
 * Returns a Fixture<T> (status + body + headers) on every call.
 * The caller is responsible for treating 4xx/5xx as errors,
 * mirroring how the real HTTP client behaves.
 *
 * - Fixture file exists → return it (no real call)
 * - No fixture file    → call real function, redact specified fields, save to disk
 *
 * Fixture files live at: apps/api/tests/fixtures/<name>.json
 *
 * @example
 * const vcr = new VCR();
 *
 * // Happy path — loads from fixtures/anthropic/chatCompletion.json
 * const fixture = await vcr.call(
 *   'anthropic/chatCompletion',
 *   () => anthropic.messages.create({ ... }),
 *   { redact: ['id', 'usage'] },
 * );
 * if (fixture.status >= 400) throw new Error(`Anthropic API error (${fixture.status})`);
 * return fixture.body;
 *
 * // Error path — point at an error fixture file
 * const fixture = await vcr.call('anthropic/errors/rateLimited', () => anthropic.messages.create({ ... }));
 * // fixture = { status: 429, body: { message: 'Rate limit exceeded...' } }
 */
export class VCR {
  async call<T>(
    fixtureName: string,
    realCall: () => Promise<T>,
    options: { redact?: string[] } = {},
  ): Promise<Fixture<T>> {
    const fixturePath = join(FIXTURES_DIR, `${fixtureName}.json`);

    if (existsSync(fixturePath)) {
      return JSON.parse(readFileSync(fixturePath, 'utf-8')) as Fixture<T>;
    }

    // No fixture — call real function, redact specified fields, write, return
    const raw = await realCall();
    const fixture: Fixture<T> = { status: 200, body: redact(raw, options.redact ?? []) };
    mkdirSync(dirname(fixturePath), { recursive: true });
    writeFileSync(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`);
    return fixture;
  }
}
