import { afterEach, beforeEach, describe, expect, it, setSystemTime, spyOn } from 'bun:test';
import { redisClient } from '@template/db';
import { claimStreamSeq } from '#/ws/queries/claimStreamSeq';
import { publishStreamAppend } from '#/ws/queries/publishStreamAppend';
import { readStreamSeq } from '#/ws/queries/readStreamSeq';
import { STREAM_SEQ_TTL_MS, streamSeqKey } from '#/ws/streamSeq';

const stream = 'seqtest:stream';

describe('stream seq counter', () => {
  beforeEach(async () => {
    await redisClient().del(streamSeqKey(stream));
  });

  afterEach(() => {
    setSystemTime();
  });

  const publish = () =>
    publishStreamAppend(redisClient(), 'seqtest:channel', [streamSeqKey(stream)], {
      type: 'stream',
      target: stream,
    }).then(([seq]) => seq as number);

  const read = () => readStreamSeq(redisClient(), streamSeqKey(stream));

  it('a snapshot stamp is the seq of the last append, and the next append is one past it', async () => {
    await publish();
    const stamp = await read();
    expect(stamp.counted).toBe(true);
    expect(await read()).toEqual(stamp);

    expect(await publish()).toBe(stamp.seq + 1);
    expect(await publish()).toBe(stamp.seq + 2);
    expect((await read()).seq).toBe(stamp.seq + 2);
  });

  it('a read of an absent counter writes nothing', async () => {
    const first = await read();
    expect(first.counted).toBe(false);
    expect(await redisClient().exists(streamSeqKey(stream))).toBe(0);
  });

  it('a claim seeds an absent counter with the read, so the next append is one past the stamp', async () => {
    const stamp = await read();
    expect(await claimStreamSeq(redisClient(), streamSeqKey(stream), stamp)).toBe(true);

    expect(await redisClient().pttl(streamSeqKey(stream))).toBeGreaterThan(
      STREAM_SEQ_TTL_MS - 5_000,
    );
    expect(await publish()).toBe(stamp.seq + 1);
  });

  it('a claim fails when the counter was created after the read, so that read cannot stamp', async () => {
    const stamp = await read();
    await publish();
    expect(await claimStreamSeq(redisClient(), streamSeqKey(stream), stamp)).toBe(false);

    const lower = { seq: stamp.seq - 1_000_000, counted: false };
    await redisClient().del(streamSeqKey(stream));
    await claimStreamSeq(redisClient(), streamSeqKey(stream), lower);
    expect(await claimStreamSeq(redisClient(), streamSeqKey(stream), stamp)).toBe(false);
  });

  it('every append and every claim of a counted read refreshes the counter ttl', async () => {
    const redis = redisClient();
    await publish();
    await redis.pexpire(streamSeqKey(stream), 1_000);
    expect(await claimStreamSeq(redis, streamSeqKey(stream), await read())).toBe(true);
    expect(await redis.pttl(streamSeqKey(stream))).toBeGreaterThan(STREAM_SEQ_TTL_MS - 5_000);

    await redis.pexpire(streamSeqKey(stream), 1_000);
    await publish();
    expect(await redis.pttl(streamSeqKey(stream))).toBeGreaterThan(STREAM_SEQ_TTL_MS - 5_000);
  });

  it('a counter re-created after expiry starts above every value it held, so holders see a gap', async () => {
    let last = 0;
    for (let i = 0; i < 50; i++) last = await publish();
    await redisClient().del(streamSeqKey(stream));
    setSystemTime(new Date(Date.now() + 60_000));

    expect(await publish()).toBeGreaterThan(last + 1);
  });

  it('the seed comes from the Redis clock, so an instance whose clock lags cannot seed below held seqs', async () => {
    const last = await publish();
    await redisClient().del(streamSeqKey(stream));
    const laggingClock = spyOn(Date, 'now').mockReturnValue(Date.now() - 60 * 60_000);
    try {
      expect((await read()).seq).toBeGreaterThan(last);
      expect(await publish()).toBeGreaterThan(last + 1);
    } finally {
      laggingClock.mockRestore();
    }
  });

  it('seqs survive the round trip exactly (no float formatting in the script)', async () => {
    const seq = await publish();
    expect(Number.isSafeInteger(seq)).toBe(true);
    expect(await redisClient().get(streamSeqKey(stream))).toBe(String(seq));
    expect((await read()).seq).toBe(seq);
  });
});
