import { describe, expect, it } from 'bun:test';
import { WS_CHANNELS } from '@template/shared/ws';
import { customerRelationshipSegmentMembershipRefetchHandoffs } from '#/appEvents/handlers/customerRelationship/customerRelationshipSegmentMembershipRefetchHandoffs';
import { meChannel } from '#/ws/meChannel';

describe("a customer's segments changed: refetch on the customer's own channel", () => {
  it("a User customer: the user's /me channel", () => {
    const _id = 'meReadManySegmentMemberships';
    expect(
      customerRelationshipSegmentMembershipRefetchHandoffs({
        customerModel: 'User',
        customerId: 'u1',
      }),
    ).toEqual([
      {
        kind: 'channels',
        target: { channels: [meChannel(WS_CHANNELS[_id].name(), 'u1')] },
        message: { data: { category: 'query', action: 'refetch', key: { _id } } },
      },
    ]);
  });

  for (const [customerModel, _id] of [
    ['Organization', 'organizationReadManySegmentMemberships'],
    ['Space', 'spaceReadManySegmentMemberships'],
  ] as const)
    it(`a ${customerModel} customer`, () => {
      expect(
        customerRelationshipSegmentMembershipRefetchHandoffs({ customerModel, customerId: 'c1' }),
      ).toEqual([
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
