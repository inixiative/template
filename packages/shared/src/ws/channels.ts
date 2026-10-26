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
  userReadManySegmentMemberships: {
    name: (id: string) => channelKey({ _id: 'userReadManySegmentMemberships', path: { id } }),
  },
  organizationReadManySegmentMemberships: {
    name: (id: string) =>
      channelKey({ _id: 'organizationReadManySegmentMemberships', path: { id } }),
  },
  spaceReadManySegmentMemberships: {
    name: (id: string) => channelKey({ _id: 'spaceReadManySegmentMemberships', path: { id } }),
  },
  segmentReadManySegmentMembers: {
    name: (id: string) => channelKey({ _id: 'segmentReadManySegmentMembers', path: { id } }),
  },
} as const;

export type WSChannelFamily = keyof typeof WS_CHANNELS;
