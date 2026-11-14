/**
 * @atlas
 * @kind helper
 * @partOf primitive:appEvents
 * @uses primitive:websockets
 */
import type { CustomerModel } from '@template/db/generated/client/enums';
import { WS_CHANNELS } from '@template/shared/ws';
import { lowerFirst } from 'lodash-es';
import { refetch } from '#/appEvents/refetch';
import type { WSHandoff } from '#/appEvents/types';
import { meChannel } from '#/ws/meChannel';

type Customer = { customerModel: CustomerModel; customerId: string };

const channelOf = ({ customerModel, customerId }: Customer): WSHandoff => {
  if (customerModel === 'User') {
    const _id = 'meReadManySegmentMemberships';
    return {
      kind: 'channels',
      target: { channels: [meChannel(WS_CHANNELS[_id].name(), customerId)] },
      message: { data: refetch({ _id }) },
    };
  }
  const _id = `${lowerFirst(customerModel)}ReadManySegmentMemberships` as const;
  return {
    kind: 'channels',
    target: { channels: [WS_CHANNELS[_id].name(customerId)] },
    message: { data: refetch({ _id, path: { id: customerId } }) },
  };
};

// Flag values are read per actor on one shared channel (featureFlag.changed), so a member's change
// asks every subscriber to refetch.
const flagValuesChanged: WSHandoff = {
  kind: 'channels',
  target: { channels: [WS_CHANNELS.meReadManyFeatureFlagValues.name()] },
  message: { data: refetch({ _id: 'meReadManyFeatureFlagValues' }) },
};

export const customerSegmentsChanged = (customer: Customer): WSHandoff[] =>
  customer.customerModel === 'User'
    ? [channelOf(customer), flagValuesChanged]
    : [channelOf(customer)];
