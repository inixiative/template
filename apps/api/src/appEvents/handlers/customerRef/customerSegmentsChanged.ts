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

type Customer = { customerModel: CustomerModel; customerId: string };

export const customerSegmentsChanged = ({ customerModel, customerId }: Customer): WSHandoff[] => {
  const _id = `${lowerFirst(customerModel)}ReadManySegmentMemberships` as const;
  return [
    {
      kind: 'channels',
      target: { channels: [WS_CHANNELS[_id].name(customerId)] },
      message: { data: refetch({ _id, path: { id: customerId } }) },
    },
  ];
};
