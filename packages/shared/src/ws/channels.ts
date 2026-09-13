/**
 * @atlas
 * @kind registry
 * @partOf primitive:shared, primitive:websockets
 * @uses none
 */
import { channelKey } from '@template/shared/ws/channelKey';

// Live queries, keyed by operationId and named by channelKey(queryKey). Authorization is the
// route itself — the subscribe handler probes the operation with the connection's credential.
export const WS_CHANNELS = {
  inquiryRead: {
    type: 'query',
    name: (id: string) => channelKey({ _id: 'inquiryRead', path: { id } }),
  },
  segmentReadManySegmentMembers: {
    type: 'query',
    name: (id: string) => channelKey({ _id: 'segmentReadManySegmentMembers', path: { id } }),
  },
} as const;

export type WSChannelFamily = keyof typeof WS_CHANNELS;
