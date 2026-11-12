import { describe, expect, it } from 'bun:test';
import { settleWithin } from '@template/shared/utils/settleWithin';

const after = <T>(ms: number, value: T) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

describe('settleWithin', () => {
  it('returns the answer when it comes inside the budget, and does not call onTimeout', async () => {
    let timeouts = 0;
    expect(await settleWithin(after(0, 'answer'), 500, () => (timeouts += 1))).toBe('answer');
    expect(timeouts).toBe(0);
  });

  it('returns the onTimeout value when the answer is late', async () => {
    expect(await settleWithin(after(200, 'answer'), 20, () => 'fallback')).toBe('fallback');
  });

  it('passes a rejection that comes inside the budget through', async () => {
    await expect(
      settleWithin(Promise.reject(new Error('boom')), 500, () => 'fallback'),
    ).rejects.toThrow('boom');
  });

  it('with a spent budget, a settled promise still wins', async () => {
    expect(await settleWithin(Promise.resolve('answer'), 0, () => 'fallback')).toBe('answer');
    expect(await settleWithin(Promise.resolve('answer'), -5, () => 'fallback')).toBe('answer');
  });

  it('with a spent budget, a pending promise times out at once', async () => {
    expect(await settleWithin(after(50, 'answer'), 0, () => 'fallback')).toBe('fallback');
  });
});
