/**
 * @atlas
 * @kind registry
 * @partOf primitive:websockets
 * @uses none
 */
import type { WSSocket } from '#/ws/types';

export const byId = new Map<string, WSSocket>();
export const byChannel = new Map<string, Set<string>>();
export const byStream = new Map<string, Set<string>>();

export const indexInto = (
  map: Map<string, Set<string>>,
  key: string,
  connectionId: string,
): void => {
  let set = map.get(key);
  if (!set) {
    set = new Set();
    map.set(key, set);
  }
  set.add(connectionId);
};

export const deindexFrom = (
  map: Map<string, Set<string>>,
  key: string,
  connectionId: string,
): void => {
  const set = map.get(key);
  if (!set) return;
  set.delete(connectionId);
  if (set.size === 0) map.delete(key);
};

export const addConnection = (ws: WSSocket): void => {
  byId.set(ws.data.connectionId, ws);
};

export const removeConnection = (ws: WSSocket): void => {
  const { connectionId, channels, streams, heldAppends } = ws.data;
  byId.delete(connectionId);
  for (const channel of channels) deindexFrom(byChannel, channel, connectionId);
  for (const stream of streams) deindexFrom(byStream, stream, connectionId);
  heldAppends.clear();
};

export const clearRegistry = (): void => {
  byId.clear();
  byChannel.clear();
  byStream.clear();
};
