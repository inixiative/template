import { describe, expect, it } from 'bun:test';
import { check, requiredBindings, resolveBindings } from '@inixiative/json-rules';
import { ownedBy, ownerBindings } from '@template/db/registries/ownedBy';

describe('ownedBy', () => {
  it('one arm per FK column, fenced by its discriminator values; unbound kinds match nothing', () => {
    const rule = ownedBy('Tag', 'ownerModel');
    expect(requiredBindings(rule).size).toBe(0);

    const bound = resolveBindings(rule, ownerBindings('Organization', 'org-1'));
    expect(check(bound, { ownerModel: 'Organization', organizationId: 'org-1' })).toBe(true);
    expect(check(bound, { ownerModel: 'Organization', organizationId: 'org-2' })).not.toBe(true);
    expect(check(bound, { ownerModel: 'User', userId: 'u-9', organizationId: null })).not.toBe(true);
    expect(check(bound, { ownerModel: 'platform', userId: null, organizationId: null })).not.toBe(true);
  });

  it('a composite value is reached through the column it shares with the single-key kind', () => {
    const bound = resolveBindings(ownedBy('CommunicationLog', 'senderType'), ownerBindings('Organization', 'org-1'));
    expect(check(bound, { senderType: 'OrganizationUser', senderOrganizationId: 'org-1', senderUserId: 'u-1' })).toBe(
      true,
    );
    expect(check(bound, { senderType: 'Organization', senderOrganizationId: 'org-1' })).toBe(true);
    expect(check(bound, { senderType: 'User', senderUserId: 'u-9', senderOrganizationId: null })).not.toBe(true);
  });

  it('refuses an axis the registry does not declare', () => {
    expect(() => ownedBy('Tag', 'nope')).toThrow('no false-polymorphic axis');
  });
});
