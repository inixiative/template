/**
 * @atlas
 * @kind utils
 * @partOf primitive:appEvents
 * @uses primitive:websockets
 */
import { refetchQueryEvent, WS_CHANNELS } from '@template/shared/ws';
import { lowerFirst } from 'lodash-es';
import type { WSHandoff } from '#/appEvents/types';
import type { CustomerSide } from '#/modules/customerRelationship/lib/customerRelationshipSides';
import { meChannel } from '#/ws/meChannel';

const channelOf = ({ customerModel, customerId }: CustomerSide): WSHandoff => {
  if (customerModel === 'User') {
    const _id = 'meReadManySegmentMemberships';
    return {
      kind: 'channels',
      target: { channels: [meChannel(WS_CHANNELS[_id].name(), customerId)] },
      message: { data: refetchQueryEvent({ _id }) },
    };
  }
  const _id = `${lowerFirst(customerModel)}ReadManySegmentMemberships` as const;
  return {
    kind: 'channels',
    target: { channels: [WS_CHANNELS[_id].name(customerId)] },
    message: { data: refetchQueryEvent({ _id, path: { id: customerId } }) },
  };
};

export const customerRelationshipSegmentMembershipRefetchHandoffs = (
  customer: CustomerSide,
): WSHandoff[] => [channelOf(customer)];
