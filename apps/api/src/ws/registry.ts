/**
 * @atlas
 * @kind registry
 * @partOf primitive:websockets
 */
// Storage layer for the local WS connection registry — the maps + generic index
// primitives + create/delete. Sibling files attach meaning: identity.ts (byUser),
// subscriptions.ts (byChannel), delivery.ts (reads + sends), lifecycle.ts (sweeps).
// Cross-instance fan-out is pubsub's job; it re-injects remote emits through
// delivery's *Local functions. This file stays single-instance and pure.

import type { WSSocket } from '#/ws/types';

export const byId = new Map<string, WSSocket>();
export const byUser = new Map<string, Set<string>>();
export const byChannel = new Map<string, Set<string>>();

export const indexInto = (map: Map<string, Set<string>>, key: string, connectionId: string): void => {
  let set = map.get(key);
  if (!set) {
    set = new Set();
    map.set(key, set);
  }
  set.add(connectionId);
};

export const deindexFrom = (map: Map<string, Set<string>>, key: string, connectionId: string): void => {
  const set = map.get(key);
  if (!set) return;
  set.delete(connectionId);
  if (set.size === 0) map.delete(key);
};

export const addConnection = (ws: WSSocket): void => {
  const { connectionId, userId } = ws.data;
  byId.set(connectionId, ws);
  if (userId) indexInto(byUser, userId, connectionId);
};

// Removes the connection and cleans every index it appears in (user + all
// channels). registry owns the full index shape, so full cleanup lives here.
export const removeConnection = (ws: WSSocket): void => {
  const { connectionId, userId, channels } = ws.data;
  byId.delete(connectionId);
  if (userId) deindexFrom(byUser, userId, connectionId);
  for (const channel of channels) deindexFrom(byChannel, channel, connectionId);
};

// Clears all registry state. Used by drainConnections on shutdown + tests.
export const clearRegistry = (): void => {
  byId.clear();
  byUser.clear();
  byChannel.clear();
};
