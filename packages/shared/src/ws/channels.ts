/**
 * @atlas
 * @kind registry
 * @partOf primitive:shared, primitive:websockets
 * @uses none
 */
import { channelKey } from '@template/shared/ws/channelKey';

// Live queries and data streams, keyed by operationId and named by channelKey(queryKey). Authorization is the
// route itself — subscribe probes the operation with the connection's credential; open requests it.
export const WS_CHANNELS = {
  inquiryRead: {
    type: 'query',
    name: (id: string) => channelKey({ _id: 'inquiryRead', path: { id } }),
  },
  segmentReadManySegmentMembers: {
    type: 'query',
    name: (id: string) => channelKey({ _id: 'segmentReadManySegmentMembers', path: { id } }),
  },
  organizationReadManyContacts: {
    type: 'stream',
    name: (id: string) => channelKey({ _id: 'organizationReadManyContacts', path: { id } }),
  },
} as const;

export type WSChannelFamily = keyof typeof WS_CHANNELS;

export type WSChannelType = (typeof WS_CHANNELS)[WSChannelFamily]['type'];

export type WSStreamFamily = {
  [F in WSChannelFamily]: (typeof WS_CHANNELS)[F]['type'] extends 'stream' ? F : never;
}[WSChannelFamily];
