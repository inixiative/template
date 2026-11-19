import { describe, expect, it } from 'bun:test';
import { wherePolymorphicSideIsOneOf } from '@template/db/registries/wherePolymorphicSideIsOneOf';

describe('wherePolymorphicSideIsOneOf', () => {
  it('one arm per kind, each with that kind’s own key column and its ids once', () => {
    expect(
      wherePolymorphicSideIsOneOf('CustomerRelationship', 'customerModel', [
        { kind: 'User', id: 'u1' },
        { kind: 'Organization', id: 'o1' },
        { kind: 'User', id: 'u2' },
        { kind: 'User', id: 'u1' },
      ]),
    ).toEqual({
      OR: [
        { customerModel: 'User', customerUserId: { in: ['u1', 'u2'] } },
        { customerModel: 'Organization', customerOrganizationId: { in: ['o1'] } },
      ],
    });
  });

  it('no targets is an empty OR, which matches nothing', () => {
    expect(wherePolymorphicSideIsOneOf('WebhookSubscription', 'ownerModel', [])).toEqual({
      OR: [],
    });
  });

  it('throws on a kind the side has no arm for', () => {
    expect(() =>
      wherePolymorphicSideIsOneOf('CustomerRelationship', 'customerModel', [
        { kind: 'Tag', id: 't1' },
      ]),
    ).toThrow('CustomerRelationship.customerModel has no Tag arm');
  });
});
