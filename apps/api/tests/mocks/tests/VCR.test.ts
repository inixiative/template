import { describe, expect, test } from 'bun:test';
import { VCR } from '../VCR';

describe('VCR', () => {
  test('returns fixture from disk when file exists', async () => {
    const vcr = new VCR();

    const fixture = await vcr.call('anthropic/chatCompletion', async () => {
      throw new Error('should not call real function');
    });

    expect(fixture.status).toBe(200);
    expect(fixture.body).toBeDefined();
  });

  test('returns error fixture from disk without throwing', async () => {
    const vcr = new VCR();

    const fixture = await vcr.call('anthropic/errors/rateLimited', async () => {
      throw new Error('should not call real function');
    });

    expect(fixture.status).toBe(429);
    expect(fixture.body).toBeDefined();
  });

  test('caller is responsible for throwing on 4xx status', async () => {
    const vcr = new VCR();

    const fixture = await vcr.call('anthropic/errors/rateLimited', async () => ({ id: 'real' }));

    expect(fixture.status).toBeGreaterThanOrEqual(400);
    // Simulates how a mock API client handles the response
    expect(() => {
      if (fixture.status >= 400) throw new Error(`API error (${fixture.status})`);
    }).toThrow('API error (429)');
  });

  test('calls real function and wraps in fixture when no file exists', async () => {
    const vcr = new VCR();
    const fakeName = `__test__/nonexistent_${Date.now()}`;

    const fixture = await vcr.call(fakeName, async () => ({ value: 'from real call' }));

    expect(fixture.status).toBe(200);
    expect((fixture.body as { value: string }).value).toBe('from real call');
  });

  test('redacts specified fields before writing fixture', async () => {
    const vcr = new VCR();
    const fakeName = `__test__/redact_${Date.now()}`;

    const fixture = await vcr.call(
      fakeName,
      async () => ({ id: 'real-id', secret: 'real-secret', name: 'keep-me' }),
      { redact: ['secret'] },
    );

    expect((fixture.body as { secret: string }).secret).toBe('REDACTED');
    expect((fixture.body as { name: string }).name).toBe('keep-me');
  });
});
