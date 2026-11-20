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
    ).toEqual({ sourceModel: 'EmailTemplate', sourceId: { in: ['t1'] } });
  });

  it('an owner match is one flat filter on the side’s columns: the owner and what carries its keys', () => {
    expect(
      wherePolymorphicSideIsOneOf('Inquiry', 'targetModel', [
        { ownerKeys: { Organization: 'o1', Space: 's1', User: null } },
      ]),
    ).toEqual({ targetOrganizationId: 'o1', targetSpaceId: 's1', targetUserId: null });
  });

  it('several sides: rows where any of them matches', () => {
    expect(
      wherePolymorphicSideIsOneOf(
        'Inquiry',
        ['sourceModel', 'targetModel'],
        [{ ownerKeys: { Organization: 'o1', Space: null, User: null } }],
      ),
    ).toEqual({
      OR: [
        { sourceOrganizationId: 'o1', sourceSpaceId: null, sourceUserId: null },
        { targetOrganizationId: 'o1', targetSpaceId: null, targetUserId: null },
      ],
    });
  });

  it('rows and owners mix on one side', () => {
    expect(
      wherePolymorphicSideIsOneOf('Inquiry', 'targetModel', [
        { model: 'Token', id: 't1' },
        { ownerKeys: { User: 'u1' } },
      ]),
    ).toEqual({
      OR: [{ targetModel: 'Token', targetId: { in: ['t1'] } }, { targetUserId: 'u1' }],
    });
  });
});
