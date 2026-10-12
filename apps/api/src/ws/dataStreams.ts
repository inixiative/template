/**
 * @atlas
 * @kind service
 * @partOf primitive:websockets
 * @uses none
 */
import { getRedisClient } from '@template/db';
import { streamSnapshotFrame } from '#/ws/dataFrame';
import { sendFrame, sendTo } from '#/ws/delivery';
import { readStreamSeq } from '#/ws/queries/readStreamSeq';
import { byId } from '#/ws/registry';
import { rejectDataStream } from '#/ws/rejectDataStream';
import { streamSeqKeyFor } from '#/ws/streamSeq';
import { fetchStreamSnapshot } from '#/ws/streamSnapshot';
import { subscribeToStream, unsubscribeFromStream } from '#/ws/streamSubscriptions';
import type { WSSocket } from '#/ws/types';

// Seq first: every append at or below it is already in the snapshot that follows.
const readSnapshot = async (ws: WSSocket, stream: string) => {
  const seq = await readStreamSeq(getRedisClient(), streamSeqKeyFor(stream, ws.data.userId));
  return { seq, read: await fetchStreamSnapshot(ws.data.headers, stream) };
};

// Subscribed before the snapshot read so no later append is missed; held appends flush after it.
export const openDataStream = async (ws: WSSocket, stream: string): Promise<void> => {
  if (!byId.has(ws.data.connectionId)) return;
  subscribeToStream(ws, stream);
  const held: string[] = [];
  ws.data.heldAppends.set(stream, held);

  const { seq, read } = await readSnapshot(ws, stream).catch((error: unknown) => {
    unsubscribeFromStream(ws, stream);
    throw error;
  });
  if (!byId.has(ws.data.connectionId)) return;

  if (read.access !== 'granted') return rejectDataStream(ws, stream, read.access);
  ws.data.heldAppends.delete(stream);
  sendTo(ws, { type: 'opened', stream });
  sendTo(ws, streamSnapshotFrame(stream, seq, read.payload));
  for (const message of held) sendFrame(ws, message);
};

export const closeDataStream = (ws: WSSocket, stream: string): void => {
  unsubscribeFromStream(ws, stream);
  sendTo(ws, { type: 'closed', stream });
};
