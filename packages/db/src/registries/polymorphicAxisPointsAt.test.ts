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

  it("an organization does not read what is on its spaces: a Space sender's organizationId is its owner chain", () => {
    const condition = conditionPolymorphicAxisPointsAtBoundRow('CommunicationLog', 'senderModel');
    const space = { senderModel: 'Space', senderOrganizationId: 'org-1', senderSpaceId: 'space-1' };
    const spaceUser = { ...space, senderModel: 'SpaceUser', senderUserId: 'user-1' };
    const organizationUser = {
      senderModel: 'OrganizationUser',
      senderOrganizationId: 'org-1',
      senderUserId: 'user-1',
    };
    const asOrganization = bindRule(condition, polymorphicBindings('Organization', 'org-1'));
    expect(check(asOrganization, space)).not.toBe(true);
    expect(check(asOrganization, spaceUser)).not.toBe(true);
    expect(check(asOrganization, organizationUser)).toBe(true);
    const asSpace = bindRule(condition, polymorphicBindings('Space', 'space-1'));
    expect(check(asSpace, space)).toBe(true);
    expect(check(asSpace, spaceUser)).toBe(true);
    const asUser = bindRule(condition, polymorphicBindings('User', 'user-1'));
    expect(check(asUser, spaceUser)).toBe(true);
    expect(check(asUser, organizationUser)).toBe(true);
  });
});
