import { describe, expect, test } from 'bun:test';

import { waitFor } from '@template/shared/test/waitFor';

describe('waitFor', () => {
  test('returns as soon as the condition holds', async () => {
    let ready = false;
    setTimeout(() => {
      ready = true;
    }, 10);
    const started = Date.now();
    await waitFor(() => ready);
    expect(Date.now() - started).toBeLessThan(500);
  });

  test('awaits an async condition', async () => {
    let calls = 0;
    await waitFor(async () => ++calls >= 3);
    expect(calls).toBe(3);
  });

  test('throws once the deadline passes with the condition still false', async () => {
    await expect(waitFor(() => false, 20)).rejects.toThrow('condition still false after 20ms');
  });
});
