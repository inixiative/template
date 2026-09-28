/**
 * @atlas
 * @kind registry
 * @partOf primitive:shared, primitive:websockets
 * @uses none
 */
import { channelKey } from '@template/shared/ws/channelKey';

export const WS_CHANNELS = {
  inquiryRead: {
    name: (id: string) => channelKey({ _id: 'inquiryRead', path: { id } }),
  },
  segmentReadManySegmentMembers: {
    name: (id: string) => channelKey({ _id: 'segmentReadManySegmentMembers', path: { id } }),
  },
} as const;

export type WSChannelFamily = keyof typeof WS_CHANNELS;
