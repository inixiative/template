/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses primitive:websockets
 */
import type { ProviderModel } from '@template/db/generated/client/enums';
import { refetchQueryEvent, WS_CHANNELS } from '@template/shared/ws';
import { makeAppEvent } from '#/appEvents/makeAppEvent';

export type SegmentMembersAddedPayload = {
  segmentId: string;
  ownerModel: ProviderModel;
  ownerId: string;
  customerRefIds: string[];
};

export const segmentMembersAdded = makeAppEvent<SegmentMembersAddedPayload>({
  websocket: (data) => [
    {
      kind: 'channels',
      target: { channels: [WS_CHANNELS.segmentReadManySegmentMembers.name(data.segmentId)] },
      message: {
        data: refetchQueryEvent({
          _id: 'segmentReadManySegmentMembers',
          path: { id: data.segmentId },
        }),
      },
    },
  ],
});
