/**
 * @atlas
 * @kind registry
 * @partOf primitive:websockets
 * @uses none
 */
import type { WSSocket } from '#/ws/types';

export const connectionsById = new Map<string, WSSocket>();
export const connectionIdsByChannel = new Map<string, Set<string>>();
export const connectionIdsByStream = new Map<string, Set<string>>();

export const addConnectionIdToIndex = (
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

export const removeConnectionIdFromIndex = (
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
  connectionsById.set(ws.data.connectionId, ws);
};

export const removeConnection = (ws: WSSocket): void => {
  const { connectionId, channels, streams, heldAppends } = ws.data;
  connectionsById.delete(connectionId);
  for (const channel of channels)
    removeConnectionIdFromIndex(connectionIdsByChannel, channel, connectionId);
  for (const stream of streams)
    removeConnectionIdFromIndex(connectionIdsByStream, stream, connectionId);
  heldAppends.clear();
};

export const clearRegistry = (): void => {
  connectionsById.clear();
  connectionIdsByChannel.clear();
  connectionIdsByStream.clear();
};
