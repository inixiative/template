import { afterEach, describe, expect, it } from 'bun:test';
import { makeUnrefInterval } from '#/lib/utils/makeUnrefInterval';

describe('makeUnrefInterval', () => {
  const originalSetInterval = globalThis.setInterval;

  afterEach(() => {
    globalThis.setInterval = originalSetInterval;
  });

  it('unrefs the timer so a pending tick cannot hold a shutdown open', () => {
    let unrefCalls = 0;
    // @ts-expect-error — narrow stub; only the unref contract matters.
    globalThis.setInterval = () => ({ unref: () => (unrefCalls += 1) });

    makeUnrefInterval({ intervalMs: 1000, tick: () => {} }).start();

    expect(unrefCalls).toBe(1);
  });

  it('starts once, so a repeated start cannot stack tickers', () => {
    let created = 0;
    // @ts-expect-error — narrow stub; we only count constructions.
    globalThis.setInterval = () => {
      created += 1;
      return { unref: () => {} };
    };

    const ticker = makeUnrefInterval({ intervalMs: 1000, tick: () => {} });
    ticker.start();
    ticker.start();

    expect(created).toBe(1);
    expect(ticker.isRunning()).toBe(true);
  });

  it('runs the tick on the interval and stops when told', async () => {
    let ticks = 0;
    const ticker = makeUnrefInterval({ intervalMs: 5, tick: () => (ticks += 1) });

    ticker.start();
    await new Promise((resolve) => setTimeout(resolve, 30));
    ticker.stop();
    const afterStop = ticks;
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(afterStop).toBeGreaterThan(0);
    expect(ticks).toBe(afterStop);
    expect(ticker.isRunning()).toBe(false);
  });

  it('can be restarted after stopping', () => {
    const ticker = makeUnrefInterval({ intervalMs: 1000, tick: () => {} });

    ticker.start();
    ticker.stop();
    expect(ticker.isRunning()).toBe(false);

    ticker.start();
    expect(ticker.isRunning()).toBe(true);
    ticker.stop();
  });

  it('ignores a stop when never started', () => {
    const ticker = makeUnrefInterval({ intervalMs: 1000, tick: () => {} });

    expect(() => ticker.stop()).not.toThrow();
    expect(ticker.isRunning()).toBe(false);
  });
});
