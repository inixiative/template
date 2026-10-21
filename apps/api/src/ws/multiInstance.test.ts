import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { range } from 'lodash-es';
import { startWsCluster, type WSCluster, type WSInstance } from '#tests/wsInstance/startWsCluster';

type Frame = Record<string, unknown>;

const appendIds = (frames: Frame[]) => frames.map((frame) => (frame.payload as { id: string }).id);

const appendSeqs = (frames: Frame[]) => frames.map((frame) => frame.seq as number);

const expectContiguous = (seqs: number[]) => {
  const first = seqs[0] as number;
  expect(seqs).toEqual(range(first, first + seqs.length));
};

const waitForFrames = async (
  instance: WSInstance,
  connectionId: string,
  count: number,
  timeoutMs = 10_000,
): Promise<Frame[]> => {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    const frames = await instance.frames(connectionId);
    if (frames.length >= count) return frames;
    if (Date.now() > deadline)
      throw new Error(`${connectionId} received ${frames.length} of ${count} frames`);
    await Bun.sleep(25);
  }
};

const ids = (tag: string, count: number) => range(count).map((n) => `${tag}-${n}`);

describe('ws data streams across API instances (real Redis, one process per instance)', () => {
  let cluster: WSCluster;
  let apiA: WSInstance;
  let apiB: WSInstance;
  let worker: WSInstance;

  beforeAll(async () => {
    cluster = await startWsCluster();
    [apiA, apiB, worker] = await Promise.all([
      cluster.instance('api-a'),
      cluster.instance('api-b'),
      cluster.instance('worker', { subscribes: false }),
    ]);
  }, 120_000);

  afterAll(() => cluster?.stop());

  it('every holder on every instance hears every append of a shared stream, in one gap-free seq order', async () => {
    const stream = `shared:${crypto.randomUUID()}`;
    await Promise.all([
      apiA.send({ op: 'hold', connectionId: 'a1', stream }),
      apiA.send({ op: 'hold', connectionId: 'a2', stream }),
      apiB.send({ op: 'hold', connectionId: 'b1', stream }),
    ]);

    await Promise.all([
      apiA.send({ op: 'append', stream, ids: ids('a', 100) }),
      apiB.send({ op: 'append', stream, ids: ids('b', 100) }),
      worker.send({ op: 'append', stream, ids: ids('w', 100) }),
    ]);

    const [a1, a2, b1] = await Promise.all([
      waitForFrames(apiA, 'a1', 300),
      waitForFrames(apiA, 'a2', 300),
      waitForFrames(apiB, 'b1', 300),
    ]);
    for (const frames of [a1, a2, b1]) {
      expect(frames).toHaveLength(300);
      expectContiguous(appendSeqs(frames));
    }
    expect(appendIds(b1)).toEqual(appendIds(a1));
    expect(appendSeqs(b1)).toEqual(appendSeqs(a1));
    expect(new Set(appendIds(a1)).size).toBe(300);
    for (const tag of ['a', 'b', 'w'])
      expect(appendIds(a1).filter((id) => id.startsWith(`${tag}-`))).toEqual(ids(tag, 100));
  }, 30_000);

  it('a per-recipient stream keeps one gap-free counter per user across instances', async () => {
    const stream = `perRecipient:${crypto.randomUUID()}`;
    await Promise.all([
      apiA.send({ op: 'hold', connectionId: 'alice', stream, userId: 'alice' }),
      apiB.send({ op: 'hold', connectionId: 'bob', stream, userId: 'bob' }),
    ]);

    await Promise.all([
      apiA.send({ op: 'append', stream, ids: ids('both-a', 20), userIds: ['alice', 'bob'] }),
      apiB.send({ op: 'append', stream, ids: ids('alice-b', 20), userIds: ['alice'] }),
      worker.send({ op: 'append', stream, ids: ids('both-w', 20), userIds: ['bob', 'alice'] }),
    ]);

    const [alice, bob] = await Promise.all([
      waitForFrames(apiA, 'alice', 60),
      waitForFrames(apiB, 'bob', 40),
    ]);
    expectContiguous(appendSeqs(alice));
    expectContiguous(appendSeqs(bob));
    expect(alice).toHaveLength(60);
    expect(bob).toHaveLength(40);
    expect(appendIds(bob).some((id) => id.startsWith('alice-'))).toBe(false);
  }, 30_000);

  it('an instance whose subscriber drops resyncs its holders; the other instance misses nothing', async () => {
    const stream = `reconnect:${crypto.randomUUID()}`;
    await Promise.all([
      apiA.send({ op: 'hold', connectionId: 'a-reconnect', stream }),
      apiB.send({ op: 'hold', connectionId: 'b-reconnect', stream }),
    ]);

    await apiA.send({ op: 'dropSubscriber', downMs: 500 });
    await apiB.send({ op: 'append', stream, ids: ids('during-outage', 5) });
    await apiA.send({ op: 'awaitSubscriber' });

    const aFrames = await waitForFrames(apiA, 'a-reconnect', 1);
    expect(aFrames).toEqual([{ type: 'resync', stream }]);
    const bFrames = await waitForFrames(apiB, 'b-reconnect', 5);
    expect(appendIds(bFrames)).toEqual(ids('during-outage', 5));
    expectContiguous(appendSeqs(bFrames));
  }, 30_000);

  it.each([
    ['the instance holding the stream', () => apiA],
    ['a worker with no sockets', () => worker],
  ])(
    'an append Redis cannot sequence on %s resyncs that stream on every instance',
    async (_, origin) => {
      const stream = `unsequenced:${crypto.randomUUID()}`;
      await Promise.all([
        apiA.send({ op: 'hold', connectionId: `a-${stream}`, stream }),
        apiB.send({ op: 'hold', connectionId: `b-${stream}`, stream }),
      ]);

      await origin().send({ op: 'failAppends', count: 1 });
      await origin().send({ op: 'append', stream, ids: ['lost'] });

      const [aFrames, bFrames] = await Promise.all([
        waitForFrames(apiA, `a-${stream}`, 1),
        waitForFrames(apiB, `b-${stream}`, 1),
      ]);
      expect(aFrames).toEqual([{ type: 'resync', stream }]);
      expect(bFrames).toEqual([{ type: 'resync', stream }]);
    },
    30_000,
  );
});
