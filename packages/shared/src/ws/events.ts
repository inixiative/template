/**
 * @atlas
 * @kind type
 * @partOf primitive:shared, primitive:websockets
 * @uses none
 */
import type { ChannelKeyInput } from '@template/shared/ws/channelKey';

export type WSQueryEvent = { category: 'query'; action: 'refetch'; key: ChannelKeyInput };

export type WSStreamSnapshotEvent = { category: 'data'; action: 'snapshot'; stream: string; payload: unknown };

export type WSStreamAppendEvent = {
  category: 'data';
  action: 'append';
  stream: string;
  type: string;
  payload: unknown;
};

export type WSDataEvent = WSStreamSnapshotEvent | WSStreamAppendEvent;

export type WSEvent = WSQueryEvent | WSDataEvent;
