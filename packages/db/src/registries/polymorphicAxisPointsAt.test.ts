import { describe, expect, it } from 'bun:test';
import { bindRule, check, listBindings } from '@inixiative/json-rules';
import {
  conditionPolymorphicAxisPointsAtBoundRow,
  polymorphicBindings,
} from '@template/db/registries/polymorphicAxisPointsAt';

describe('conditionPolymorphicAxisPointsAtBoundRow', () => {
  it('one arm per FK column, fenced by its discriminator values; unbound kinds match nothing', () => {
    const rule = conditionPolymorphicAxisPointsAtBoundRow('Tag', 'ownerModel');
    expect(listBindings(rule, { required: true })).toEqual([]);

    const bound = bindRule(rule, polymorphicBindings('Organization', 'org-1'));
    expect(check(bound, { ownerModel: 'Organization', organizationId: 'org-1' })).toBe(true);
    expect(check(bound, { ownerModel: 'Organization', organizationId: 'org-2' })).not.toBe(true);
    expect(check(bound, { ownerModel: 'User', userId: 'u-9', organizationId: null })).not.toBe(
      true,
    );
    expect(check(bound, { ownerModel: 'platform', userId: null, organizationId: null })).not.toBe(
      true,
    );
  });

  it('a composite value is reached through the column it shares with the single-key kind', () => {
    const bound = bindRule(
      conditionPolymorphicAxisPointsAtBoundRow('CommunicationLog', 'senderModel'),
      polymorphicBindings('Organization', 'org-1'),
    );
    expect(
      check(bound, {
        senderModel: 'OrganizationUser',
        senderOrganizationId: 'org-1',
        senderUserId: 'u-1',
      }),
    ).toBe(true);
    expect(check(bound, { senderModel: 'Organization', senderOrganizationId: 'org-1' })).toBe(true);
    expect(
      check(bound, { senderModel: 'User', senderUserId: 'u-9', senderOrganizationId: null }),
    ).not.toBe(true);
  });

  it('refuses an axis the registry does not declare', () => {
    expect(() => conditionPolymorphicAxisPointsAtBoundRow('Tag', 'nope')).toThrow(
      'no false-polymorphic axis',
    );
  });

  it('a composite arm binds through its own id column: a Space owner through spaceId', () => {
    const bound = bindRule(
      conditionPolymorphicAxisPointsAtBoundRow('EmailTemplate', 'ownerModel'),
      polymorphicBindings('Space', 'space-1'),
    );
    expect(check(bound, { ownerModel: 'Space', organizationId: 'org-1', spaceId: 'space-1' })).toBe(
      true,
    );
    expect(
      check(bound, { ownerModel: 'Space', organizationId: 'org-1', spaceId: 'space-2' }),
    ).not.toBe(true);
  });
});
