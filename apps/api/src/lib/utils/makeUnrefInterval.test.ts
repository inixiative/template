import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { makeUnrefInterval } from '#/lib/utils/makeUnrefInterval';

describe('makeUnrefInterval', () => {
  afterEach(() => {
    mock.restore();
  });

  it('unrefs the timer so a pending tick cannot hold a shutdown open', () => {
    let unrefCalls = 0;
    spyOn(globalThis, 'setInterval').mockImplementation((() => ({ unref: () => (unrefCalls += 1) })) as never);

    makeUnrefInterval({ intervalMs: 1000, tick: () => {} }).start();

    expect(unrefCalls).toBe(1);
  });

  it('starts once, so a repeated start cannot stack tickers', () => {
    let created = 0;
    spyOn(globalThis, 'setInterval').mockImplementation((() => {
      created += 1;
      return { unref: () => {} };
    }) as never);

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
