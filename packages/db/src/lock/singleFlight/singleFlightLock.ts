/**
 * @atlas
 * @kind constructor
 * @partOf primitive:caching, infrastructure:redis, mutex
 * @uses none
 */
import { createLock } from '@template/db/lock/createLock';
import { lockKeyOf } from '@template/db/lock/lockKeyOf';

const SINGLE_FLIGHT_LOCK_TTL_MS = 2_000;
const SINGLE_FLIGHT_HEARTBEAT_MS = 500;

const SINGLE_FLIGHT_SERVICE = 'cache-singleflight';

export const singleFlightLock = (key: string) =>
  createLock({
    service: SINGLE_FLIGHT_SERVICE,
    identifier: key,
    ttlMs: SINGLE_FLIGHT_LOCK_TTL_MS,
    heartbeatMs: SINGLE_FLIGHT_HEARTBEAT_MS,
  });

export const singleFlightLockKey = (key: string): string =>
  lockKeyOf({ service: SINGLE_FLIGHT_SERVICE, identifier: key });
