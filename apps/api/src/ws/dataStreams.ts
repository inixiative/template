/**
 * @atlas
 * @kind service
 * @partOf primitive:websockets
 * @uses none
 */
import { getRedisClient } from '@template/db';
import { streamDefinitionOf, WS_MAX_STREAM_NAME_LENGTH } from '@template/shared/ws';
import { streamSnapshotFrame } from '#/ws/dataFrame';
import { sendFrame, sendTo } from '#/ws/delivery';
import { claimStreamSeq } from '#/ws/queries/claimStreamSeq';
import { readStreamSeq } from '#/ws/queries/readStreamSeq';
import { byId } from '#/ws/registry';
import { rejectDataStream } from '#/ws/rejectDataStream';
import { streamSeqKeyFor } from '#/ws/streamSeq';
import { fetchStreamSnapshot, type StreamRead } from '#/ws/streamSnapshot';
import { subscribeToStream, unsubscribeFromStream } from '#/ws/streamSubscriptions';
import type { WSSocket } from '#/ws/types';

const SEQ_CLAIM_ATTEMPTS = 3;

const isOpenableStreamName = (stream: unknown): stream is string =>
  typeof stream === 'string' &&
  stream.length <= WS_MAX_STREAM_NAME_LENGTH &&
  streamDefinitionOf(stream) !== null;

// Seq first: every append at or below it is already in the snapshot that follows.
const readSnapshot = async (
  ws: WSSocket,
  stream: string,
  attempt = 1,
): Promise<{ seq: number; read: StreamRead }> => {
  const redis = getRedisClient();
  const seqKey = streamSeqKeyFor(stream, ws.data.userId);
  const counter = await readStreamSeq(redis, seqKey);
  const read = await fetchStreamSnapshot(ws.data.headers, stream);
  if (read.access !== 'granted' || (await claimStreamSeq(redis, seqKey, counter)))
    return { seq: counter.seq, read };
  if (attempt >= SEQ_CLAIM_ATTEMPTS) return { seq: counter.seq, read: { access: 'retryable' } };
  return readSnapshot(ws, stream, attempt + 1);
};

// Subscribed before the snapshot read so no later append is missed; held appends flush after it.
export const openDataStream = async (ws: WSSocket, stream: string): Promise<void> => {
  if (!byId.has(ws.data.connectionId)) return;
  if (!isOpenableStreamName(stream)) return rejectDataStream(ws, stream, 'rejected');
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
