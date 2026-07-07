import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  claimLane,
  getJobSupersededBy,
  laneKey,
  reclaimLaneIfVacant,
  releaseLane,
  watchLane,
} from '@template/db/lanes/lanes';
import { getRedisClient } from '@template/db/redis/client';

// The supersede lane "baton": one Redis key per lane = its current holder (a jobId). Latest claim wins
// and tombstones the displaced job; a running job watchLanes its lane and is usurped the moment a
// different jobId holds it. SET/GET plus small Lua evals, so it runs on ioredis-mock.
const redis = getRedisClient();
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const wipe = async (): Promise<void> => {
  const keys = [...(await redis.keys('lane:*')), ...(await redis.keys('superseded:*'))];
  if (keys.length) await redis.del(...keys);
};

describe('supersede lane baton', () => {
  beforeEach(wipe);
  afterEach(wipe);

  test('laneKey is handler-scoped: the same dedupeKey under two handlers is two lanes', () => {
    expect(laneKey('handlerA', 'shared')).not.toBe(laneKey('handlerB', 'shared'));
    expect(laneKey('h', 'k')).toBe(laneKey('h', 'k')); // stable for the same pair
  });

  test('claimLane records the holder; the latest claim wins and tombstones the displaced job', async () => {
    const lane = laneKey('h', 'k');
    expect(await claimLane(lane, 'job-a')).toBeNull();
    expect(await redis.get(lane)).toBe('job-a');
    expect(await claimLane(lane, 'job-b')).toBe('job-a');
    expect(await redis.get(lane)).toBe('job-b'); // last-claim-wins
    expect(await getJobSupersededBy('job-a')).toBe('job-b');
  });

  test('claimLane stretches the TTL by the job delay (the baton must outlive a scheduled delay)', async () => {
    // A delayed job is only picked up after `delay`, and only a RUNNING job refreshes its lane via
    // watchLane — with a fixed TTL the baton would expire mid-delay and the usurp would be missed.
    const lane = laneKey('h', 'delayed');
    await claimLane(lane, 'job-a', 60_000);
    const ttl = await redis.ttl(lane);
    expect(ttl).toBeGreaterThan(300); // base 300s + 60s delay
    expect(ttl).toBeLessThanOrEqual(360);

    await claimLane(lane, 'job-a'); // no delay → base TTL only
    expect(await redis.ttl(lane)).toBeLessThanOrEqual(300);
  });

  test('reclaimLaneIfVacant restores a lapsed baton but never steals from a live holder', async () => {
    const lane = laneKey('h', 'reclaim');
    // Vacant (expired while the job sat queued) → the starting job re-asserts itself.
    await reclaimLaneIfVacant(lane, 'job-a');
    expect(await redis.get(lane)).toBe('job-a');
    // Held → NX no-op: a newer claimant keeps the baton (so it still usurps the reclaimer).
    await reclaimLaneIfVacant(lane, 'job-b');
    expect(await redis.get(lane)).toBe('job-a');
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

  test('releaseLane drops the baton only if we still hold it (fenced)', async () => {
    const lane = laneKey('h', 'release');
    await claimLane(lane, 'job-a');
    await releaseLane(lane, 'job-b'); // not the holder — must NOT delete job-a's baton
    expect(await redis.get(lane)).toBe('job-a');
    await releaseLane(lane, 'job-a'); // the holder — drops it
    expect(await redis.get(lane)).toBeNull();
  });

  test('releaseLane rolls back both this claim and the tombstone it created', async () => {
    const lane = laneKey('h', 'rollback');
    await claimLane(lane, 'job-a');
    const previousHolder = await claimLane(lane, 'job-b');

    await releaseLane(lane, 'job-b', previousHolder);

    expect(await redis.get(lane)).toBeNull();
    expect(await getJobSupersededBy('job-a')).toBeNull();
  });

  test('releaseLane does not clear a newer claimant or its tombstone', async () => {
    const lane = laneKey('h', 'rollback-race');
    await claimLane(lane, 'job-a');
    const previousHolder = await claimLane(lane, 'job-b');
    await claimLane(lane, 'job-c');

    await releaseLane(lane, 'job-b', previousHolder);

    expect(await redis.get(lane)).toBe('job-c');
    expect(await getJobSupersededBy('job-a')).toBe('job-b');
    expect(await getJobSupersededBy('job-b')).toBe('job-c');
  });

  test('watchLane refreshes the TTL while this job still holds the lane', async () => {
    const lane = laneKey('h', 'refresh');
    await claimLane(lane, 'job-a');
    await redis.pexpire(lane, 2000); // would lapse soon without a refresh
    const stop = watchLane(lane, 'job-a', () => {});
    await sleep(1200); // > two polls (500ms) — a poll while we hold refreshes the TTL back up
    stop();
    expect(await redis.pttl(lane)).toBeGreaterThan(5000); // refreshed well past the original 2s
  });
});
