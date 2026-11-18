/**
 * @atlas
 * @kind constructor
 * @partOf primitive:caching, infrastructure:redis, mutex
 * @uses none
 */

import { lockKeyOf } from '@template/db/lock/lockKeyOf';
import { makeLock } from '@template/db/lock/makeLock';

const SINGLE_FLIGHT_LOCK_TTL_MS = 2_000;
const SINGLE_FLIGHT_HEARTBEAT_MS = 500;

const SINGLE_FLIGHT_SERVICE = 'cache-singleflight';

export const singleFlightLock = (key: string) =>
  makeLock({
    service: SINGLE_FLIGHT_SERVICE,
    identifier: key,
    ttlMs: SINGLE_FLIGHT_LOCK_TTL_MS,
    heartbeatMs: SINGLE_FLIGHT_HEARTBEAT_MS,
  });

export const singleFlightLockKey = (key: string): string =>
  lockKeyOf({ service: SINGLE_FLIGHT_SERVICE, identifier: key });
