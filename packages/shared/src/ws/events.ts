/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared, primitive:websockets
 * @uses none
 */
import type { ChannelKeyInput } from '@template/shared/ws/channelKey';

export type WSQueryEvent = { category: 'query'; action: 'refetch'; key: ChannelKeyInput };

export const refetchQueryEvent = (key: ChannelKeyInput): WSQueryEvent => ({
  category: 'query',
  action: 'refetch',
  key,
});

export type WSStreamSnapshotEvent = {
  category: 'data';
  action: 'snapshot';
  stream: string;
  seq: number;
  payload: unknown;
};

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

export type WSStreamAppendEvent = {
  category: 'data';
  action: 'append';
  stream: string;
  seq: number;
  type: string;
  payload: unknown;
  revive?: true;
};

export type StreamAppend = Pick<WSStreamAppendEvent, 'type' | 'payload' | 'revive'>;

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

export type WSDataEvent = WSStreamSnapshotEvent | WSStreamAppendEvent;

export type WSEvent = WSQueryEvent | WSDataEvent;
