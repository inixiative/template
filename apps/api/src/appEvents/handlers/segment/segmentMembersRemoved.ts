/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses primitive:websockets
 */
import type { ProviderModel } from '@template/db/generated/client/enums';
import { WS_CHANNELS } from '@template/shared/ws';
import { makeAppEvent } from '#/appEvents/makeAppEvent';
import { refetch } from '#/appEvents/refetch';

export type SegmentMembersRemovedPayload = {
  segmentId: string;
  ownerModel: ProviderModel;
  ownerId: string;
  customerRefIds: string[];
};

export const segmentMembersRemoved = makeAppEvent<SegmentMembersRemovedPayload>({
  websocket: (data) => [
    {
      target: { channels: [WS_CHANNELS.segmentReadManySegmentMembers.name(data.segmentId)] },
      message: { data: refetch({ _id: 'segmentReadManySegmentMembers', path: { id: data.segmentId } }) },
    },
  ],
});
