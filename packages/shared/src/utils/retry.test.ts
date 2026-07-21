import { describe, expect, test } from 'bun:test';

import { withRetry } from '@template/shared/utils/retry';

describe('withRetry', () => {
  test('returns the first successful result', async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls += 1;
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(calls).toBe(1);
  });

  test('retries until success', async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls += 1;
        if (calls < 3) throw new Error('transient');
        return 'ok';
      },
      { baseDelayMs: 1 },
    );
    expect(result).toBe('ok');
    expect(calls).toBe(3);
  });

  test('throws after exhausting attempts', async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw new Error('always');
        },
        { attempts: 2, baseDelayMs: 1 },
      ),
    ).rejects.toThrow('always');
    expect(calls).toBe(2);
  });

  test('does not retry non-retryable errors', async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw new Error('fatal');
        },
        { baseDelayMs: 1, isRetryable: () => false },
      ),
    ).rejects.toThrow('fatal');
    expect(calls).toBe(1);
  });
});
