import { describe, expect, it } from 'bun:test';
import { isShutdownInProgress, sleepUnlessShuttingDown } from '#/lib/shutdown';

describe('sleepUnlessShuttingDown', () => {
  it('waits the full duration while no shutdown is in progress', async () => {
    expect(isShutdownInProgress()).toBe(false);
    const startedAt = Date.now();
    await sleepUnlessShuttingDown(300);
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(290);
  });
});
