import { describe, expect, it } from 'bun:test';
import { createSerializedQueue } from '@template/shared/utils/serializedQueue';

describe('createSerializedQueue', () => {
  it('runs operations in submission order even when later ones resolve faster', async () => {
    const queue = createSerializedQueue();
    const completed: number[] = [];

    const slow = queue.run(async () => {
      await new Promise((r) => setTimeout(r, 30));
      completed.push(1);
    });
    const fast = queue.run(async () => {
      completed.push(2);
    });
    await Promise.all([slow, fast]);

    expect(completed).toEqual([1, 2]);
  });

  it('passes through the resolved value of each operation', async () => {
    const queue = createSerializedQueue();
    const a = queue.run(async () => 'a');
    const b = queue.run(async () => 'b');
    expect(await a).toBe('a');
    expect(await b).toBe('b');
  });

  it('rejects only the failing op; the next one still runs', async () => {
    const queue = createSerializedQueue();
    const completed: string[] = [];

    const failing = queue.run(async () => {
      throw new Error('boom');
    });
    const after = queue.run(async () => {
      completed.push('ran');
    });

    await expect(failing).rejects.toThrow('boom');
    await after;
    expect(completed).toEqual(['ran']);
  });

  it('does not start the next op until the previous settles', async () => {
    const queue = createSerializedQueue();
    let firstResolve!: () => void;
    const firstStarted = new Promise<void>((r) => {
      firstResolve = r;
    });
    let secondStarted = false;

    queue.run(async () => {
      firstResolve();
      await new Promise((r) => setTimeout(r, 20));
    });
    const secondPromise = queue.run(async () => {
      secondStarted = true;
    });

    await firstStarted;
    expect(secondStarted).toBe(false);
    await secondPromise;
    expect(secondStarted).toBe(true);
  });
});
