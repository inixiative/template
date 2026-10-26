import { describe, expect, it } from 'bun:test';
import { WS_CHANNELS } from '@template/shared/ws';
import { customerSegmentsChanged } from '#/appEvents/handlers/customerRef/customerSegmentsChanged';

describe("a customer's segments changed: refetch on the customer's own channel", () => {
  for (const [customerModel, _id] of [
    ['User', 'userReadManySegmentMemberships'],
    ['Organization', 'organizationReadManySegmentMemberships'],
    ['Space', 'spaceReadManySegmentMemberships'],
  ] as const)
    it(`a ${customerModel} customer`, () => {
      expect(customerSegmentsChanged({ customerModel, customerId: 'c1' })).toEqual([
        {
          kind: 'channels',
          target: { channels: [WS_CHANNELS[_id].name('c1')] },
          message: {
            data: { category: 'query', action: 'refetch', key: { _id, path: { id: 'c1' } } },
          },
        },
      ]);
    });
});
