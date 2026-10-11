import { beforeEach, describe, expect, it } from 'bun:test';
import { getRedisClient } from '@template/db';
import { publishStreamAppend } from '#/ws/queries/publishStreamAppend';
import { readStreamSeq } from '#/ws/queries/readStreamSeq';
import { STREAM_SEQ_TTL_MS, streamSeqKey } from '#/ws/streamSeq';

const stream = 'seqtest:stream';

describe('stream seq counter', () => {
  beforeEach(async () => {
    await getRedisClient().del(streamSeqKey(stream));
  });

  const publish = () =>
    publishStreamAppend(getRedisClient(), 'seqtest:channel', [streamSeqKey(stream)], {
      type: 'stream',
      target: stream,
    }).then(([seq]) => seq as number);

  it('a snapshot stamp is the seq of the last append, and the next append is one past it', async () => {
    const stamp = await readStreamSeq(getRedisClient(), streamSeqKey(stream));
    expect(await readStreamSeq(getRedisClient(), streamSeqKey(stream))).toBe(stamp);

    expect(await publish()).toBe(stamp + 1);
    expect(await publish()).toBe(stamp + 2);
    expect(await readStreamSeq(getRedisClient(), streamSeqKey(stream))).toBe(stamp + 2);
  });

  it('every append and every read refreshes the counter ttl', async () => {
    const redis = getRedisClient();
    await publish();
    await redis.pexpire(streamSeqKey(stream), 1_000);
    await readStreamSeq(redis, streamSeqKey(stream));
    expect(await redis.pttl(streamSeqKey(stream))).toBeGreaterThan(STREAM_SEQ_TTL_MS - 5_000);

    await redis.pexpire(streamSeqKey(stream), 1_000);
    await publish();
    expect(await redis.pttl(streamSeqKey(stream))).toBeGreaterThan(STREAM_SEQ_TTL_MS - 5_000);
  });

  it('a counter re-created after expiry starts above every value it held, so holders see a gap', async () => {
    let last = 0;
    for (let i = 0; i < 50; i++) last = await publish();
    await getRedisClient().del(streamSeqKey(stream));
    await new Promise((resolve) => setTimeout(resolve, 2));

    expect(await publish()).toBeGreaterThan(last + 1);
  });

  it('seqs survive the round trip exactly (no float formatting in the script)', async () => {
    const seq = await publish();
    expect(Number.isSafeInteger(seq)).toBe(true);
    expect(await getRedisClient().get(streamSeqKey(stream))).toBe(String(seq));
  });
});
