import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { claimLane, laneKey, watchLane } from '@template/db/lanes/lanes';
import { getRedisClient } from '@template/db/redis/client';

// The supersede lane "baton": one Redis key per lane = its current holder (a jobId). Latest claim wins;
// a running job watchLanes its lane and is usurped the moment a different jobId holds it. Plain SET/GET,
// so it runs on ioredis-mock — no integration harness needed.
const redis = getRedisClient();
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const wipe = async (): Promise<void> => {
  const keys = await redis.keys('lane:*');
  if (keys.length) await redis.del(...keys);
};

describe('supersede lane baton', () => {
  beforeEach(wipe);
  afterEach(wipe);

  test('laneKey is handler-scoped: the same dedupeKey under two handlers is two lanes', () => {
    expect(laneKey('handlerA', 'shared')).not.toBe(laneKey('handlerB', 'shared'));
    expect(laneKey('h', 'k')).toBe(laneKey('h', 'k')); // stable for the same pair
  });

  test('claimLane records the holder; the latest claim wins', async () => {
    const lane = laneKey('h', 'k');
    await claimLane(lane, 'job-a');
    expect(await redis.get(lane)).toBe('job-a');
    await claimLane(lane, 'job-b');
    expect(await redis.get(lane)).toBe('job-b'); // last-claim-wins
  });

  test('watchLane fires onUsurped once a different job claims the lane', async () => {
    const lane = laneKey('h', 'usurp');
    await claimLane(lane, 'job-a');
    let usurped = false;
    const stop = watchLane(lane, 'job-a', () => {
      usurped = true;
    });
    await claimLane(lane, 'job-b'); // a newer job takes the baton
    await sleep(700); // > one poll interval (500ms)
    stop();
    expect(usurped).toBe(true);
  });

  test('watchLane does NOT fire while this job still holds the lane (absent == still held)', async () => {
    const lane = laneKey('h', 'hold');
    await claimLane(lane, 'job-a');
    let usurped = false;
    const stop = watchLane(lane, 'job-a', () => {
      usurped = true;
    });
    await sleep(700); // still job-a's
    await redis.del(lane); // simulate TTL expiry — an absent lane counts as still held, not usurped
    await sleep(700);
    stop();
    expect(usurped).toBe(false);
  });
});
