/**
 * @atlas
 * @kind helper
 * @partOf primitive:websockets
 * @uses primitive:shared
 */
import type { WSStreamAppendEvent, WSStreamSnapshotEvent } from '@template/shared/ws';

export type StreamAppend = { type: string; payload: unknown; revive?: true };

export const streamSnapshotFrame = (
  stream: string,
  seq: number,
  payload: unknown,
): WSStreamSnapshotEvent => ({
  category: 'data',
  action: 'snapshot',
  stream,
  seq,
  payload,
});

export const streamAppendFrame = (
  stream: string,
  seq: number,
  { type, payload, revive }: StreamAppend,
): WSStreamAppendEvent => ({
  category: 'data',
  action: 'append',
  stream,
  seq,
  type,
  payload,
  ...(revive ? { revive: true } : {}),
});
