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

  test('reports each retry and waits through the injected sleep with exponential backoff', async () => {
    const retries: Array<{ message: string; attempt: number; waitMs: number }> = [];
    const waits: number[] = [];
    let calls = 0;

    const result = await withRetry(
      async () => {
        calls += 1;
        if (calls < 4) throw new Error(`fail-${calls}`);
        return 'ok';
      },
      {
        attempts: 4,
        baseDelayMs: 2_000,
        onRetry: (error, attempt, waitMs) => retries.push({ message: (error as Error).message, attempt, waitMs }),
        sleep: async (ms) => {
          waits.push(ms);
        },
      },
    );

    expect(result).toBe('ok');
    expect(retries).toEqual([
      { message: 'fail-1', attempt: 1, waitMs: 2_000 },
      { message: 'fail-2', attempt: 2, waitMs: 4_000 },
      { message: 'fail-3', attempt: 3, waitMs: 8_000 },
    ]);
    expect(waits).toEqual([2_000, 4_000, 8_000]);
  });

  test('does not report a retry for the final failed attempt', async () => {
    const attempts: number[] = [];
    await expect(
      withRetry(
        async () => {
          throw new Error('always');
        },
        { attempts: 2, onRetry: (_error, attempt) => attempts.push(attempt), sleep: async () => {} },
      ),
    ).rejects.toThrow('always');
    expect(attempts).toEqual([1]);
  });
});
