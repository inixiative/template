/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses primitive:caching
 */
import { makeAppEvent } from '#/appEvents/makeAppEvent';

export type RollingCacheLeafStuckPayload = {
  rollingCache: string;
  key: string;
  target: unknown;
  timeoutSeconds: number;
  attempt: number;
};

// Raised by a rolling-cache leaf (refreshRollingCacheTarget) whose attempt ran past the cache's
// `timeoutSeconds`. The payload is the leaf's provenance: which cache, which key, the target row, the
// timeout and which attempt. No handler work: the event (recorded by the observe adapters, an AppEvent
// row included) is the hook an app wires its alert to.
export const rollingCacheLeafStuck = makeAppEvent<RollingCacheLeafStuckPayload>({});
