import { describe, expect, it } from 'bun:test';
import { heartbeat } from './heartbeat';

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe('heartbeat', () => {
  it('runs the beat repeatedly until stopped', async () => {
    let beats = 0;
    const stop = heartbeat(() => {
      beats += 1;
    }, 20);
    await sleep(75);
    stop();
    const atStop = beats;
    await sleep(60);
    expect(atStop).toBeGreaterThanOrEqual(2);
    expect(beats).toBe(atStop); // nothing fires after stop()
  });

  it('never overlaps a slow async beat (awaits before rescheduling)', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    const stop = heartbeat(async () => {
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await sleep(40); // longer than the 10ms interval — setInterval would stack these
      concurrent -= 1;
    }, 10);
    await sleep(150);
    stop();
    await sleep(60);
    expect(maxConcurrent).toBe(1);
  });

  it('routes a throwing beat to onError and keeps going', async () => {
    let beats = 0;
    const errors: unknown[] = [];
    const stop = heartbeat(
      () => {
        beats += 1;
        throw new Error(`boom ${beats}`);
      },
      20,
      { onError: (e) => errors.push(e) },
    );
    await sleep(75);
    stop();
    expect(beats).toBeGreaterThanOrEqual(2); // didn't die on the first throw
    expect(errors.length).toBe(beats);
  });

  it('stop() cancels the pending tick', async () => {
    let beats = 0;
    const stop = heartbeat(() => {
      beats += 1;
    }, 30);
    stop(); // before the first tick fires
    await sleep(80);
    expect(beats).toBe(0);
  });
});
