import { describe, expect, it } from 'bun:test';
import { resolveAll } from '@template/shared/utils/resolveAll';

describe('resolveAll', () => {
  it('executes all functions and returns results in order', async () => {
    const fns = [async () => 1, async () => 2, async () => 3];
    const results = await resolveAll(fns);
    expect(results).toEqual([1, 2, 3]);
  });

  it('respects concurrency limit', async () => {
    let running = 0;
    let maxRunning = 0;

    const createFn = (id: number) => async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((r) => setTimeout(r, 50));
      running--;
      return id;
    };

    const fns = Array.from({ length: 10 }, (_, i) => createFn(i));
    const results = await resolveAll(fns, 3);

    expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(maxRunning).toBe(3);
  });

  it.skip('stress test - verifies concurrency under load', async () => {
    let running = 0;
    let maxRunning = 0;
    const concurrencyLimit = 5;

    const createFn = (id: number) => async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      // Random delay 10-50ms
      await new Promise((r) => setTimeout(r, 10 + Math.random() * 40));
      running--;
      return id;
    };

    const fns = Array.from({ length: 100 }, (_, i) => createFn(i));
    const results = await resolveAll(fns, concurrencyLimit);

    expect(results.length).toBe(100);
    expect(maxRunning).toBeLessThanOrEqual(concurrencyLimit);
    console.log(`Max concurrent: ${maxRunning} (limit: ${concurrencyLimit})`);
  });

  it('runs all in parallel when concurrency >= length', async () => {
    let running = 0;
    let maxRunning = 0;

    const createFn = () => async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((r) => setTimeout(r, 10));
      running--;
      return 1;
    };

    const fns = Array.from({ length: 5 }, createFn);
    await resolveAll(fns, 10);

    expect(maxRunning).toBe(5); // All 5 should run in parallel
  });

  it('runs all in parallel when no concurrency specified', async () => {
    let running = 0;
    let maxRunning = 0;

    const createFn = () => async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((r) => setTimeout(r, 10));
      running--;
      return 1;
    };

    const fns = Array.from({ length: 5 }, createFn);
    await resolveAll(fns);

    expect(maxRunning).toBe(5);
  });
});
