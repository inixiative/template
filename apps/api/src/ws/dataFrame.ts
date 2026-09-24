/**
 * @atlas
 * @kind helper
 * @partOf primitive:websockets
 * @uses primitive:shared
 */
import type { WSStreamAppendEvent, WSStreamSnapshotEvent } from '@template/shared/ws';

export const streamSnapshotFrame = (stream: string, payload: unknown): WSStreamSnapshotEvent => ({
  category: 'data',
  action: 'snapshot',
  stream,
  payload,
});

export const streamAppendFrame = (stream: string, type: string, payload: unknown): WSStreamAppendEvent => ({
  category: 'data',
  action: 'append',
  stream,
  type,
  payload,
});
