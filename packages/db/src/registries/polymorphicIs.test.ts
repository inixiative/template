import { describe, expect, it } from 'bun:test';
import { check, requiredBindings, resolveBindings } from '@inixiative/json-rules';
import { polymorphicBindings, polymorphicIs } from '@template/db/registries/polymorphicIs';

describe('polymorphicIs', () => {
  it('one arm per FK column, fenced by its discriminator values; unbound kinds match nothing', () => {
    const rule = polymorphicIs('Tag', 'ownerModel');
    expect(requiredBindings(rule).size).toBe(0);

    const bound = resolveBindings(rule, polymorphicBindings('Organization', 'org-1'));
    expect(check(bound, { ownerModel: 'Organization', organizationId: 'org-1' })).toBe(true);
    expect(check(bound, { ownerModel: 'Organization', organizationId: 'org-2' })).not.toBe(true);
    expect(check(bound, { ownerModel: 'User', userId: 'u-9', organizationId: null })).not.toBe(true);
    expect(check(bound, { ownerModel: 'platform', userId: null, organizationId: null })).not.toBe(true);
  });

  it('a composite value is reached through the column it shares with the single-key kind', () => {
    const bound = resolveBindings(
      polymorphicIs('CommunicationLog', 'senderType'),
      polymorphicBindings('Organization', 'org-1'),
    );
    expect(check(bound, { senderType: 'OrganizationUser', senderOrganizationId: 'org-1', senderUserId: 'u-1' })).toBe(
      true,
    );
    expect(check(bound, { senderType: 'Organization', senderOrganizationId: 'org-1' })).toBe(true);
    expect(check(bound, { senderType: 'User', senderUserId: 'u-9', senderOrganizationId: null })).not.toBe(true);
  });

  it('a no-FK owner is bound by its discriminator: platform rows match only when platform is the bound owner', () => {
    const rule = polymorphicIs('Tag', 'ownerModel');
    expect(requiredBindings(rule).size).toBe(0);
    expect(polymorphicBindings('platform', 'platform')).toEqual({ platform: ['platform'] });

    const asPlatform = resolveBindings(rule, polymorphicBindings('platform', 'platform'));
    expect(check(asPlatform, { ownerModel: 'platform', userId: null, organizationId: null, spaceId: null })).toBe(true);
    expect(check(asPlatform, { ownerModel: 'Organization', organizationId: 'org-1' })).not.toBe(true);

    const asOrg = resolveBindings(rule, polymorphicBindings('Organization', 'org-1'));
    expect(check(asOrg, { ownerModel: 'platform', userId: null, organizationId: null, spaceId: null })).not.toBe(true);
  });

  it('a value with keys keeps its FK arm and gains no discriminator arm', () => {
    const rule = polymorphicIs('Tag', 'ownerModel') as { any: unknown[] };
    const discriminatorArms = rule.any.filter((arm) =>
      JSON.stringify(arm).includes('"bind":"platform"'),
    );
    expect(discriminatorArms).toHaveLength(1);
    expect(JSON.stringify(rule)).not.toContain('"bind":"Organization"');
  });

  it('the provider axes carry the platform arm', () => {
    for (const [model, axis] of [
      ['Segment', 'ownerModel'],
      ['CustomerRef', 'providerModel'],
    ] as const) {
      const asPlatform = resolveBindings(polymorphicIs(model, axis), polymorphicBindings('platform', 'platform'));
      expect(check(asPlatform, { [axis]: 'platform' })).toBe(true);
      const asOrg = resolveBindings(polymorphicIs(model, axis), polymorphicBindings('Organization', 'org-1'));
      expect(check(asOrg, { [axis]: 'platform' })).not.toBe(true);
    }
  });

  it('refuses an axis the registry does not declare, and a kind no single key binds', () => {
    expect(() => polymorphicIs('Tag', 'nope')).toThrow('no false-polymorphic axis');
    expect(() => polymorphicIs('EmailTemplate', 'ownerModel')).toThrow('no single kind binds');
  });
});
