import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  claimLane,
  claimLaneUnlessNewerHolder,
  fetchSupersededBy,
  holdLaneWhileParked,
  type LaneStore,
  laneKey,
  markDisplacedHolder,
  watchLane,
} from '@template/db/lanes/lanes';
import { redisClient } from '@template/db/redis/client';

const redis = redisClient();
const store: LaneStore = { redis, holderKeyPrefix: 'holder:', supersededField: 'supersededBy' };
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const createHolderRecord = (holderId: string) => redis.hset(`holder:${holderId}`, 'name', holderId);

const wipe = async (): Promise<void> => {
  const keys = [...(await redis.keys('lane:*')), ...(await redis.keys('holder:*'))];
  if (keys.length) await redis.del(...keys);
};

describe('supersede lanes', () => {
  beforeEach(wipe);
  afterEach(wipe);

  test('laneKey is handler-scoped: the same dedupeKey under two handlers is two lanes', () => {
    expect(laneKey('handlerA', 'shared')).not.toBe(laneKey('handlerB', 'shared'));
    expect(laneKey('h', 'k')).toBe(laneKey('h', 'k'));
  });

  test('claimLane records the holder and returns the one it displaced, writing no other key', async () => {
    const lane = laneKey('h', 'k');
    expect(await claimLane(store, lane, 'job-a')).toBeNull();
    expect(await claimLane(store, lane, 'job-b')).toBe('job-a');
    expect(await redis.get(lane)).toBe('job-b');
    expect(await redis.keys('*superseded*')).toEqual([]);
  });

  test('claimLane stretches the TTL by the job delay', async () => {
    const lane = laneKey('h', 'delayed');
    await claimLane(store, lane, 'job-a', 60_000);
    const ttl = await redis.ttl(lane);
    expect(ttl).toBeGreaterThan(300);
    expect(ttl).toBeLessThanOrEqual(360);
  });

  test('markDisplacedHolder marks the displaced holder on its own record once the new holder exists', async () => {
    const lane = laneKey('h', 'mark');
    await createHolderRecord('job-a');
    await claimLane(store, lane, 'job-a');
    const previous = await claimLane(store, lane, 'job-b');
    await createHolderRecord('job-b');
    await markDisplacedHolder(store, lane, 'job-b', previous);
    expect(await fetchSupersededBy(store, 'job-a')).toBe('job-b');
    expect(await fetchSupersededBy(store, 'job-b')).toBeNull();
  });

  test('markDisplacedHolder never creates a record for a holder that has none', async () => {
    const lane = laneKey('h', 'gone');
    await claimLane(store, lane, 'job-a');
    const previous = await claimLane(store, lane, 'job-b');
    await markDisplacedHolder(store, lane, 'job-b', previous);
    expect(await redis.exists('holder:job-a')).toBe(0);
  });

  test('a newer claim that lands before the add: the new holder marks itself superseded', async () => {
    const lane = laneKey('h', 'race');
    const previous = await claimLane(store, lane, 'job-b');
    await claimLane(store, lane, 'job-c');
    await createHolderRecord('job-b');
    await markDisplacedHolder(store, lane, 'job-b', previous);
    expect(await fetchSupersededBy(store, 'job-b')).toBe('job-c');
  });

  test('claimLaneUnlessNewerHolder takes a vacant lane or one held by an older holder', async () => {
    const lane = laneKey('h', 'reclaim');
    expect(await claimLaneUnlessNewerHolder(store, lane, 'job-b')).toEqual({
      claimed: true,
      previous: null,
    });
    expect(await claimLaneUnlessNewerHolder(store, lane, 'job-c')).toEqual({
      claimed: true,
      previous: 'job-b',
    });
  });

  test('claimLaneUnlessNewerHolder refuses a lane held by a newer holder that exists', async () => {
    const lane = laneKey('h', 'newer');
    await createHolderRecord('job-c');
    await claimLane(store, lane, 'job-c');
    expect(await claimLaneUnlessNewerHolder(store, lane, 'job-a')).toEqual({
      claimed: false,
      previous: 'job-c',
    });
    expect(await redis.get(lane)).toBe('job-c');
  });

  test('claimLaneUnlessNewerHolder treats a newer holder with no record (a failed add) as no holder', async () => {
    const lane = laneKey('h', 'phantom');
    await claimLane(store, lane, 'job-c');
    expect((await claimLaneUnlessNewerHolder(store, lane, 'job-a')).claimed).toBe(true);
    expect(await redis.get(lane)).toBe('job-a');
  });

  test('holdLaneWhileParked stretches a lane it still holds to three hours, and leaves a newer holder alone', async () => {
    const lane = laneKey('h', 'parked');
    await claimLane(store, lane, 'job-a');
    expect(await holdLaneWhileParked(store, lane, 'job-a')).toBe(true);
    const ttl = await redis.ttl(lane);
    expect(ttl).toBeGreaterThan(2 * 60 * 60);
    expect(ttl).toBeLessThanOrEqual(3 * 60 * 60);

    await claimLane(store, lane, 'job-b');
    expect(await holdLaneWhileParked(store, lane, 'job-a')).toBe(false);
  });

  test('watchLane stops a holder whose lane another existing holder took, and marks it', async () => {
    const lane = laneKey('h', 'usurp');
    await createHolderRecord('job-a');
    await claimLane(store, lane, 'job-a');
    let supersededBy = null as string | null;
    const stop = watchLane(store, { lane, holderId: 'job-a' }, (by) => {
      supersededBy = by;
    });
    await createHolderRecord('job-b');
    await claimLane(store, lane, 'job-b');
    await sleep(700);
    stop();
    expect(supersededBy).toBe('job-b');
    expect(await fetchSupersededBy(store, 'job-a')).toBe('job-b');
  });

  test('watchLane keeps running while the lane names a job that never existed', async () => {
    const lane = laneKey('h', 'phantom-watch');
    await claimLane(store, lane, 'job-a');
    let supersededBy = null as string | null;
    const stop = watchLane(store, { lane, holderId: 'job-a' }, (by) => {
      supersededBy = by;
    });
    await claimLane(store, lane, 'job-b');
    await sleep(700);
    stop();
    expect(supersededBy).toBeNull();
  });

  test('watchLane stops a child whose parent is superseded, and passes the superseder to the child', async () => {
    const lane = laneKey('h', 'child');
    await createHolderRecord('child-job');
    await createHolderRecord('parent-job');
    await claimLane(store, lane, 'child-job');
    let supersededBy = null as string | null;
    const stop = watchLane(
      store,
      { lane, holderId: 'child-job', parent: { holderId: 'parent-job' } },
      (by) => {
        supersededBy = by;
      },
    );
    await redis.hset('holder:parent-job', 'supersededBy', 'newer-parent');
    await sleep(700);
    stop();
    expect(supersededBy).toBe('newer-parent');
    expect(await fetchSupersededBy(store, 'child-job')).toBe('newer-parent');
  });

  test('watchLane refreshes its own lane, and its parked parent lane while the parent still holds it', async () => {
    const lane = laneKey('h', 'refresh');
    const parentLane = laneKey('parent', 'refresh');
    await claimLane(store, lane, 'child-job');
    await claimLane(store, parentLane, 'parent-job');
    await redis.pexpire(lane, 2000);
    await redis.pexpire(parentLane, 2000);
    const stop = watchLane(
      store,
      { lane, holderId: 'child-job', parent: { holderId: 'parent-job', lane: parentLane } },
      () => {},
    );
    await sleep(1200);
    stop();
    expect(await redis.pttl(lane)).toBeGreaterThan(5000);
    expect(await redis.pttl(parentLane)).toBeGreaterThan(60 * 60 * 1000);
  });
});
