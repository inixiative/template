/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses feature:segment, primitive:websockets
 */
import type { ProviderModel } from '@template/db/generated/client/enums';
import { WS_CHANNELS, type WSEvent } from '@template/shared/ws';
import { makeAppEvent } from '#/appEvents/makeAppEvent';
import type { WSHandoff } from '#/appEvents/types';

export type SegmentMembershipChangedPayload = {
  segmentId: string;
  ownerModel: ProviderModel;
  ownerId: string;
  added: string[];
  removed: string[];
  customerUserIds: string[];
};

const refetch = (key: WSEvent['key']): WSEvent => ({ category: 'query', action: 'refetch', key });

export const segmentMembershipChanged = makeAppEvent<SegmentMembershipChangedPayload>({
  websocket: (data) => {
    const handoffs: WSHandoff[] = [
      {
        target: { channels: [WS_CHANNELS.segmentReadManySegmentMembers.name(data.segmentId)] },
        message: { data: refetch({ _id: 'segmentReadManySegmentMembers', path: { id: data.segmentId } }) },
      },
    ];
    if (data.customerUserIds.length) {
      handoffs.push({
        target: { userIds: data.customerUserIds },
        message: { data: refetch({ _id: 'meReadManySegmentMemberships' }) },
      });
    }
    return handoffs;
  },
});
