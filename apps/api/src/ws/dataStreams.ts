/**
 * @atlas
 * @kind service
 * @partOf primitive:websockets
 * @uses none
 */
import { streamSnapshotFrame } from '#/ws/dataFrame';
import { sendTo } from '#/ws/delivery';
import { byId } from '#/ws/registry';
import { rejectDataStream } from '#/ws/rejectDataStream';
import { fetchStreamSnapshot } from '#/ws/streamSnapshot';
import { subscribeToStream, unsubscribeFromStream } from '#/ws/streamSubscriptions';
import type { WSSocket } from '#/ws/types';

// Subscribed before the snapshot read so no later append is missed; held appends flush after it.
export const openDataStream = async (ws: WSSocket, stream: string): Promise<void> => {
  if (!byId.has(ws.data.connectionId)) return;
  subscribeToStream(ws, stream);
  const held: string[] = [];
  ws.data.heldAppends.set(stream, held);

  const read = await fetchStreamSnapshot(ws.data.headers, stream).catch((error: unknown) => {
    unsubscribeFromStream(ws, stream);
    throw error;
  });
  if (!byId.has(ws.data.connectionId)) return;

  if (read.access !== 'granted') return rejectDataStream(ws, stream, read.access);
  ws.data.heldAppends.delete(stream);
  sendTo(ws, { type: 'opened', stream });
  sendTo(ws, streamSnapshotFrame(stream, read.payload));
  for (const message of held) ws.send(message);
};

export const closeDataStream = (ws: WSSocket, stream: string): void => {
  unsubscribeFromStream(ws, stream);
  sendTo(ws, { type: 'closed', stream });
};
