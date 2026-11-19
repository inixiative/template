import { describe, expect, it } from 'bun:test';
import { wherePolymorphicSideIsOneOf } from '@template/db/registries/wherePolymorphicSideIsOneOf';

describe('wherePolymorphicSideIsOneOf', () => {
  it('one arm per kind, each with that kind’s own key column and its ids once', () => {
    expect(
      wherePolymorphicSideIsOneOf('CustomerRelationship', 'customerModel', [
        { model: 'User', id: 'u1' },
        { model: 'Organization', id: 'o1' },
        { model: 'User', id: 'u2' },
        { model: 'User', id: 'u1' },
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
        { model: 'Tag', id: 't1' },
      ]),
    ).toThrow('CustomerRelationship.customerModel has no Tag arm');
  });

  it('a dual side matches on its dual id, not the typed foreign key a hard delete nulls', () => {
    expect(
      wherePolymorphicSideIsOneOf('RuleReference', 'sourceModel', [
        { model: 'EmailTemplate', id: 't1' },
      ]),
    ).toEqual({ OR: [{ sourceModel: 'EmailTemplate', sourceId: { in: ['t1'] } }] });
  });
});
