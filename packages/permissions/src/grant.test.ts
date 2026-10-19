import { describe, expect, it } from 'bun:test';
import { MembershipAction, SessionAction } from '@template/permissions/client';
import { capGrant, grantReaches, userLoginGrant } from '@template/permissions/grant';

describe('grantReaches', () => {
  it('follows the role chain on the same resource', () => {
    const admin = { role: 'admin' as const, entitlements: null };
    expect(grantReaches('db:organization', admin, 'manage')).toBe(true);
    expect(grantReaches('db:organization', admin, 'read')).toBe(true);
    expect(grantReaches('db:organization', admin, 'own')).toBe(false);
  });

  it('an entitlement reaches the actions below it', () => {
    const viewer = { role: 'viewer' as const, entitlements: { manage: true } };
    expect(grantReaches('db:organization', viewer, 'operate')).toBe(true);
    expect(grantReaches('db:organization', viewer, 'own')).toBe(false);
  });

  it('a catalog action reaches through the role it maps to', () => {
    expect(
      grantReaches('db:user', { role: 'member', entitlements: null }, 'organization.create'),
    ).toBe(true);
    expect(
      grantReaches('db:user', { role: 'viewer', entitlements: null }, 'organization.create'),
    ).toBe(false);
  });

  it('a session action is held by the login only, never implied by a role', () => {
    expect(grantReaches('db:user', userLoginGrant, SessionAction.createToken)).toBe(true);
    expect(
      grantReaches('db:user', { role: 'owner', entitlements: null }, SessionAction.createToken),
    ).toBe(false);
  });

  it('a rule-gated action is never reached through its rule', () => {
    expect(grantReaches('db:organization', { role: 'admin', entitlements: null }, 'assign')).toBe(
      false,
    );
  });

  it('an undeclared custom action is reached only when granted', () => {
    const owner = { role: 'owner' as const, entitlements: null };
    expect(grantReaches('db:organization', owner, 'artifact.create')).toBe(false);
    expect(
      grantReaches(
        'db:organization',
        { ...owner, entitlements: { 'artifact.create': true } },
        'artifact.create',
      ),
    ).toBe(true);
  });

  it('entitlement-only drops the role base', () => {
    const grant = { role: 'owner' as const, entitlements: { read: true }, entitlementsOnly: true };
    expect(grantReaches('db:organization', grant, 'read')).toBe(true);
    expect(grantReaches('db:organization', grant, 'operate')).toBe(false);
  });
});

describe('capGrant', () => {
  const viewer = { role: 'viewer' as const, entitlements: null };
  const owner = { role: 'owner' as const, entitlements: null };

  it('default mode: lesser role, entitlements kept only where the owner reaches them', () => {
    expect(
      capGrant('db:organization', viewer, {
        role: 'owner',
        entitlements: { manage: true },
        entitlementsOnly: false,
      }),
    ).toEqual({ role: 'viewer', entitlements: null, entitlementsOnly: false });
    expect(
      capGrant('db:organization', owner, {
        role: 'viewer',
        entitlements: { manage: true },
        entitlementsOnly: false,
      }),
    ).toEqual({ role: 'viewer', entitlements: { manage: true }, entitlementsOnly: false });
  });

  it('a full grant (entitlements null) inherits the owner entitlements', () => {
    expect(
      capGrant(
        'db:organization',
        { role: 'member', entitlements: { canExport: true } },
        { role: 'member', entitlements: null, entitlementsOnly: false },
      ),
    ).toEqual({ role: 'member', entitlements: { canExport: true }, entitlementsOnly: false });
  });

  it('a full grant on the user does not inherit the session actions', () => {
    expect(
      capGrant('db:user', userLoginGrant, {
        role: 'owner',
        entitlements: null,
        entitlementsOnly: false,
      }).entitlements,
    ).toBeNull();
  });

  it('keeps an owner custom entitlement a narrowed grant names', () => {
    expect(
      capGrant(
        'db:organization',
        { role: 'member', entitlements: { canExport: true } },
        {
          role: 'member',
          entitlements: { canExport: true, canDelete: true },
          entitlementsOnly: false,
        },
      ).entitlements,
    ).toEqual({ canExport: true });
  });

  it('entitlement-only keeps only what the owner reaches', () => {
    expect(
      capGrant('db:space', viewer, {
        role: 'owner',
        entitlements: { read: true, manage: true, own: true },
        entitlementsOnly: true,
      }),
    ).toEqual({ role: 'viewer', entitlements: { read: true }, entitlementsOnly: true });
  });

  it('false entitlements are dropped', () => {
    expect(
      capGrant('db:organization', owner, {
        role: 'owner',
        entitlements: { manage: false },
        entitlementsOnly: true,
      }).entitlements,
    ).toBeNull();
  });

  it('a grant on the user holds a session action only when it names it', () => {
    expect(
      capGrant('db:user', userLoginGrant, {
        role: 'owner',
        entitlements: null,
        entitlementsOnly: false,
      }).entitlements,
    ).toBeNull();
    expect(
      capGrant('db:user', userLoginGrant, {
        role: 'viewer',
        entitlements: { [SessionAction.deleteToken]: true },
        entitlementsOnly: false,
      }).entitlements,
    ).toEqual({ [SessionAction.deleteToken]: true });
  });

  it('a grant never holds a person-only action, even when it names it', () => {
    for (const entitlementsOnly of [false, true])
      expect(
        capGrant('db:user', userLoginGrant, {
          role: 'owner',
          entitlements: {
            [SessionAction.createToken]: true,
            [SessionAction.redactUser]: true,
            [SessionAction.deleteOrganization]: true,
            [SessionAction.deleteToken]: true,
          },
          entitlementsOnly,
        }).entitlements,
      ).toEqual({ [SessionAction.deleteToken]: true });
  });

  it("a membership grant on its own row is the membership's role, capped by the grant", () => {
    const self = { role: 'owner' as const, entitlements: null };
    const member = capGrant('db:organizationUser', self, {
      role: 'member',
      entitlements: null,
      entitlementsOnly: false,
    });
    expect(member).toEqual({ role: 'member', entitlements: null, entitlementsOnly: false });
    expect(grantReaches('db:organizationUser', member, MembershipAction.operate)).toBe(true);
    expect(grantReaches('db:organizationUser', member, MembershipAction.manage)).toBe(false);
    expect(
      grantReaches('db:spaceUser', { role: 'admin', entitlements: null }, 'membership.read'),
    ).toBe(true);
  });
});
