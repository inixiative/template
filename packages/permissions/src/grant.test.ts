import { describe, expect, it } from 'bun:test';
import type { OrganizationId, UserId } from '@template/db';
import { ActorModel, buildActor } from '@template/permissions/actor';
import {
  createPermissions,
  type Entitlements,
  MembershipAction,
  SessionAction,
} from '@template/permissions/client';
import {
  type EntitlementGrant,
  findUnheldGrant,
  type GrantEntry,
  projectGrant,
  userLoginGrant,
} from '@template/permissions/grant';
import { getMembershipPermissions } from '@template/permissions/roles/membership';
import { getOrgPermissions } from '@template/permissions/roles/organization';
import { getUserPermissions } from '@template/permissions/roles/user';
import type { Role } from '@template/permissions/types';

const userId = 'user-1' as UserId;
const organizationId = 'org-1' as OrganizationId;
const userEntry: GrantEntry = { resource: 'db:user', record: { id: userId } };
const organizationEntry: GrantEntry = {
  resource: 'db:organization',
  record: { id: organizationId },
};
const membershipEntry: GrantEntry = {
  resource: 'db:organizationUser',
  record: { id: 'membership-1', userId, organizationId },
};

const person = async (membershipRole: Role, membershipEntitlements: Entitlements = null) => {
  const permix = createPermissions();
  permix.setActor(buildActor(userId, ActorModel.User, null));
  await permix.setup([
    getUserPermissions(userId, userLoginGrant.role, userLoginGrant.entitlements),
    getOrgPermissions(membershipRole, organizationId, membershipEntitlements),
    getMembershipPermissions('db:organizationUser', 'owner', 'membership-1'),
  ]);
  return permix;
};

const grant = (
  role: Role,
  entitlements: Entitlements,
  entitlementsOnly = false,
): EntitlementGrant => ({ role, entitlements, entitlementsOnly });

describe('projectGrant: a grant is what its holder can perform there', () => {
  it('takes the highest role at or below the grant that the holder holds', async () => {
    const holder = await person('member');
    expect(projectGrant(holder, organizationEntry, grant('owner', null))).toEqual(
      grant('member', null),
    );
    expect(projectGrant(holder, organizationEntry, grant('viewer', null))).toEqual(
      grant('viewer', null),
    );
  });

  it('keeps a named entitlement only where the holder holds it', async () => {
    const holder = await person('viewer');
    expect(projectGrant(holder, organizationEntry, grant('viewer', { manage: true }))).toEqual(
      grant('viewer', null),
    );
    const admin = await person('admin');
    expect(projectGrant(admin, organizationEntry, grant('viewer', { operate: true }))).toEqual(
      grant('viewer', { operate: true }),
    );
  });

  it('a full grant inherits the role: a standard-action membership entitlement lifts it', async () => {
    const holder = await person('viewer', { manage: true });
    expect(projectGrant(holder, organizationEntry, grant('owner', null))).toEqual(
      grant('admin', null),
    );
  });

  it('a full grant does not inherit an unmapped custom membership entitlement', async () => {
    const holder = await person('owner', { 'artifact.create': true });
    expect(projectGrant(holder, organizationEntry, grant('owner', null)).entitlements).toBeNull();
    expect(
      projectGrant(holder, organizationEntry, grant('owner', { 'artifact.create': true }))
        .entitlements,
    ).toEqual({ 'artifact.create': true });
  });

  it('entitlement-only keeps only the held names, false names are dropped', async () => {
    const holder = await person('member');
    expect(
      projectGrant(holder, organizationEntry, grant('owner', { read: true, manage: true }, true)),
    ).toEqual(grant('owner', { read: true }, true));
    expect(
      projectGrant(holder, organizationEntry, grant('member', { read: false })).entitlements,
    ).toBeNull();
  });

  it('with no role held, it is entitlement-only', async () => {
    const holder = createPermissions();
    expect(projectGrant(holder, organizationEntry, grant('viewer', null))).toEqual(
      grant('viewer', null, true),
    );
  });

  it('a session action is held on the user only when named', async () => {
    const holder = await person('viewer');
    expect(projectGrant(holder, userEntry, grant('owner', null))).toEqual(grant('owner', null));
    expect(
      projectGrant(holder, userEntry, grant('owner', { [SessionAction.deleteToken]: true }))
        .entitlements,
    ).toEqual({ [SessionAction.deleteToken]: true });
  });

  it('never keeps a person-only action, even named and held', async () => {
    const holder = await person('owner');
    expect(
      projectGrant(
        holder,
        userEntry,
        grant('owner', { [SessionAction.createToken]: true, [SessionAction.redactUser]: true }),
      ).entitlements,
    ).toBeNull();
  });

  it("a membership grant on its own row is the person's membership.* role", async () => {
    const holder = await person('viewer');
    expect(projectGrant(holder, membershipEntry, grant('member', null))).toEqual(
      grant('member', null),
    );
    expect(
      projectGrant(holder, membershipEntry, grant('owner', { [MembershipAction.read]: true }))
        .entitlements,
    ).toEqual({ [MembershipAction.read]: true });
  });
});

describe('findUnheldGrant: the issuer grants only what it can itself perform', () => {
  it('a holder of everything leaves nothing unheld', async () => {
    const holder = await person('owner');
    expect(
      findUnheldGrant(holder, [userEntry, organizationEntry], grant('owner', { manage: true })),
    ).toEqual([]);
  });

  it('names the role on the home entry and each name no entry keeps', async () => {
    const narrowed = createPermissions();
    await narrowed.setup(getUserPermissions(userId, 'viewer', { read: true }, true));
    expect(
      findUnheldGrant(narrowed, [userEntry], grant('viewer', { operate: true, read: true })),
    ).toEqual(['operate']);
    expect(
      findUnheldGrant(narrowed, [userEntry], grant('member', { 'artifact.create': true })),
    ).toEqual(['db:user:user-1:operate', 'artifact.create']);
  });

  it('a full grant is checked as its role', async () => {
    const narrowed = createPermissions();
    await narrowed.setup(getUserPermissions(userId, 'viewer', { read: true }, true));
    expect(findUnheldGrant(narrowed, [userEntry], grant('owner', null))).toEqual([
      'db:user:user-1:own',
    ]);
  });

  it('leaves a person-only name to the request-time projection (ruling 2 pending)', async () => {
    const holder = await person('owner');
    expect(
      findUnheldGrant(holder, [userEntry], grant('owner', { [SessionAction.createToken]: true })),
    ).toEqual([]);
  });

  it('refuses a rule-gated action named as an entitlement: it would skip its rule', async () => {
    const holder = await person('admin');
    expect(findUnheldGrant(holder, [organizationEntry], grant('viewer', { assign: true }))).toEqual(
      ['assign'],
    );
    expect(
      projectGrant(holder, organizationEntry, grant('viewer', { assign: true })).entitlements,
    ).toBeNull();
  });

  it('an entitlement-only grant skips the role', async () => {
    expect(findUnheldGrant(createPermissions(), [userEntry], grant('owner', null, true))).toEqual(
      [],
    );
  });

  it('a superadmin holds everything but a person-only name', async () => {
    const superadmin = createPermissions();
    superadmin.setSuperadmin(true);
    expect(
      findUnheldGrant(superadmin, [userEntry, organizationEntry], grant('owner', { 'x.y': true })),
    ).toEqual([]);
  });
});
