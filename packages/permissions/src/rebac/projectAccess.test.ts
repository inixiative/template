import { describe, expect, it } from 'bun:test';
import type { HydratedRecord } from '@template/db';
import { ProjectAccess, Role } from '@template/db/generated/client/enums';
import {
  ActorModel,
  createPermissions,
  type EntitlementEntry,
  installPermissions,
  type Permix,
} from '@template/permissions/client';
import { check } from '@template/permissions/rebac/check';
import {
  organizationOwnerPermissions,
  permissionsOfUser,
} from '@template/permissions/roles/permissionsOfUser';

const org = { id: 'o1' };
const otherOrg = { id: 'o2' };
const space = { id: 's1', organizationId: org.id, organization: org };
const otherSpace = { id: 's2', organizationId: org.id, organization: org };
const uOwner = { id: 'u-owner' };
const uMember = { id: 'u-member' };
const uCoworker = { id: 'u-coworker' };
const uOutsider = { id: 'u-outsider' };

const orgMemberRow = {
  id: 'ou1',
  organizationId: org.id,
  userId: uMember.id,
  organization: org,
  user: uMember,
};

const spaceMemberRow = {
  id: 'su1',
  organizationId: org.id,
  spaceId: space.id,
  userId: uMember.id,
  organization: org,
  space,
  user: uMember,
  organizationUser: orgMemberRow,
};

type Seat = {
  userId?: string;
  organizationRole?: Role;
  otherOrganizationRole?: Role;
  spaceRole?: Role;
  entitlements?: EntitlementEntry[];
  asToken?: boolean;
};

const principal = async (seat: Seat = {}): Promise<Permix> => {
  const permix = createPermissions();
  const entries = permissionsOfUser(
    seat.userId ?? null,
    [
      ...(seat.organizationRole
        ? [
            {
              id: `ou-${seat.userId ?? 'anon'}`,
              organizationId: org.id,
              role: seat.organizationRole,
            },
          ]
        : []),
      ...(seat.otherOrganizationRole
        ? [
            {
              id: `ou-other-${seat.userId ?? 'anon'}`,
              organizationId: otherOrg.id,
              role: seat.otherOrganizationRole,
            },
          ]
        : []),
    ],
    seat.spaceRole
      ? [{ id: `su-${seat.userId ?? 'anon'}`, spaceId: space.id, role: seat.spaceRole }]
      : [],
  );
  await installPermissions(permix, [
    ...entries,
    ...(seat.entitlements?.length
      ? [{ entries: seat.entitlements, owner: organizationOwnerPermissions(org.id) }]
      : []),
  ]);
  if (seat.asToken) {
    permix.setActor({
      model: ActorModel.Token,
      record: { id: 'tok1', ownerModel: 'Organization', organizationId: otherOrg.id },
    });
  } else if (seat.userId) {
    permix.setActor({ model: ActorModel.User, record: { id: seat.userId } });
  }
  return permix;
};

const actionsFor = (permix: Permix, record: object) => ({
  read: check(permix, 'project', record as HydratedRecord, 'read'),
  operate: check(permix, 'project', record as HydratedRecord, 'operate'),
  manage: check(permix, 'project', record as HydratedRecord, 'manage'),
  delete: check(permix, 'project', record as HydratedRecord, 'delete'),
});

const projectOf = (
  ownerModel: 'User' | 'Organization' | 'Space' | 'OrganizationUser' | 'SpaceUser',
  access: ProjectAccess,
) => {
  switch (ownerModel) {
    case 'User':
      return { id: `p-user-${access}`, access, ownerModel, userId: uOwner.id, user: uOwner };
    case 'Organization':
      return {
        id: `p-org-${access}`,
        access,
        ownerModel,
        organizationId: org.id,
        organization: org,
      };
    case 'Space':
      return {
        id: `p-space-${access}`,
        access,
        ownerModel,
        organizationId: org.id,
        spaceId: space.id,
        organization: org,
        space,
      };
    case 'OrganizationUser':
      return {
        id: `p-ou-${access}`,
        access,
        ownerModel,
        organizationId: org.id,
        userId: uMember.id,
        organization: org,
        user: uMember,
        organizationUser: orgMemberRow,
      };
    case 'SpaceUser':
      return {
        id: `p-su-${access}`,
        access,
        ownerModel,
        organizationId: org.id,
        spaceId: space.id,
        userId: uMember.id,
        organization: org,
        space,
        user: uMember,
        organizationUser: orgMemberRow,
        spaceUser: spaceMemberRow,
      };
  }
};

describe('db:Project visibility (ProjectAccess: public | tenant | private)', () => {
  it('Organization projects: private is admin/owner only; tenant adds member operate + viewer read; public adds universal read only', async () => {
    const anon = await principal();
    const outsider = await principal({ userId: uOutsider.id, otherOrganizationRole: Role.owner });
    const foreignToken = await principal({ otherOrganizationRole: Role.owner, asToken: true });
    const viewer = await principal({ userId: uCoworker.id, organizationRole: Role.viewer });
    const member = await principal({ userId: uMember.id, organizationRole: Role.member });
    const admin = await principal({ userId: uOwner.id, organizationRole: Role.admin });

    const priv = projectOf('Organization', ProjectAccess.private);
    expect(actionsFor(anon, priv)).toEqual({
      read: false,
      operate: false,
      manage: false,
      delete: false,
    });
    expect(actionsFor(outsider, priv)).toEqual({
      read: false,
      operate: false,
      manage: false,
      delete: false,
    });
    expect(actionsFor(viewer, priv)).toEqual({
      read: false,
      operate: false,
      manage: false,
      delete: false,
    });
    expect(actionsFor(member, priv)).toEqual({
      read: false,
      operate: false,
      manage: false,
      delete: false,
    });
    expect(actionsFor(admin, priv)).toEqual({
      read: true,
      operate: true,
      manage: true,
      delete: true,
    });

    const tenant = projectOf('Organization', ProjectAccess.tenant);
    expect(actionsFor(anon, tenant).read).toBe(false);
    expect(actionsFor(outsider, tenant).read).toBe(false);
    expect(actionsFor(viewer, tenant)).toEqual({
      read: true,
      operate: false,
      manage: false,
      delete: false,
    });
    expect(actionsFor(member, tenant)).toEqual({
      read: true,
      operate: true,
      manage: false,
      delete: false,
    });
    expect(actionsFor(admin, tenant)).toEqual({
      read: true,
      operate: true,
      manage: true,
      delete: true,
    });

    const pub = projectOf('Organization', ProjectAccess.public);
    expect(actionsFor(anon, pub)).toEqual({
      read: true,
      operate: false,
      manage: false,
      delete: false,
    });
    expect(actionsFor(outsider, pub)).toEqual({
      read: true,
      operate: false,
      manage: false,
      delete: false,
    });
    expect(actionsFor(foreignToken, pub)).toEqual({
      read: true,
      operate: false,
      manage: false,
      delete: false,
    });
    expect(actionsFor(member, pub)).toEqual({
      read: true,
      operate: true,
      manage: false,
      delete: false,
    });
  });

  it('Space projects stay isolated from non-space org members/admins while honoring org owner inheritance', async () => {
    const orgViewer = await principal({ userId: uCoworker.id, organizationRole: Role.viewer });
    const orgAdmin = await principal({ userId: uCoworker.id, organizationRole: Role.admin });
    const orgOwner = await principal({ userId: uOwner.id, organizationRole: Role.owner });
    const spaceViewer = await principal({ userId: uCoworker.id, spaceRole: Role.viewer });
    const spaceMember = await principal({ userId: uMember.id, spaceRole: Role.member });
    const spaceAdmin = await principal({ userId: uOwner.id, spaceRole: Role.admin });

    const priv = projectOf('Space', ProjectAccess.private);
    expect(actionsFor(orgAdmin, priv).read).toBe(false);
    expect(actionsFor(spaceMember, priv).read).toBe(false);
    expect(actionsFor(spaceViewer, priv).read).toBe(false);
    expect(actionsFor(spaceAdmin, priv)).toEqual({
      read: true,
      operate: true,
      manage: true,
      delete: true,
    });
    expect(actionsFor(orgOwner, priv)).toEqual({
      read: true,
      operate: true,
      manage: true,
      delete: true,
    });

    const tenant = projectOf('Space', ProjectAccess.tenant);
    expect(actionsFor(orgViewer, tenant).read).toBe(false);
    expect(actionsFor(orgAdmin, tenant).read).toBe(false);
    expect(actionsFor(spaceViewer, tenant)).toEqual({
      read: true,
      operate: false,
      manage: false,
      delete: false,
    });
    expect(actionsFor(spaceMember, tenant)).toEqual({
      read: true,
      operate: true,
      manage: false,
      delete: false,
    });

    const siblingSpaceTenant = {
      id: 'p-space-sibling-tenant',
      access: ProjectAccess.tenant,
      ownerModel: 'Space',
      organizationId: org.id,
      spaceId: otherSpace.id,
      organization: org,
      space: otherSpace,
    };
    expect(actionsFor(spaceAdmin, siblingSpaceTenant).read).toBe(false);
    expect(actionsFor(spaceMember, siblingSpaceTenant).read).toBe(false);
    expect(actionsFor(orgOwner, siblingSpaceTenant).read).toBe(true);
  });

  it('OrganizationUser projects: private is member + org owner; tenant gives coworkers read only (never operate)', async () => {
    const self = await principal({ userId: uMember.id, organizationRole: Role.member });
    const orgOwner = await principal({ userId: uOwner.id, organizationRole: Role.owner });
    const orgAdmin = await principal({ userId: uCoworker.id, organizationRole: Role.admin });
    const coworker = await principal({ userId: uCoworker.id, organizationRole: Role.viewer });
    const outsider = await principal({ userId: uOutsider.id });

    const priv = projectOf('OrganizationUser', ProjectAccess.private);
    expect(actionsFor(self, priv)).toEqual({
      read: true,
      operate: true,
      manage: true,
      delete: true,
    });
    expect(actionsFor(orgOwner, priv)).toEqual({
      read: true,
      operate: false,
      manage: false,
      delete: true,
    });
    expect(actionsFor(orgAdmin, priv)).toEqual({
      read: false,
      operate: false,
      manage: false,
      delete: false,
    });
    expect(actionsFor(coworker, priv).read).toBe(false);

    const tenant = projectOf('OrganizationUser', ProjectAccess.tenant);
    expect(actionsFor(orgAdmin, tenant)).toEqual({
      read: true,
      operate: false,
      manage: false,
      delete: false,
    });
    expect(actionsFor(coworker, tenant)).toEqual({
      read: true,
      operate: false,
      manage: false,
      delete: false,
    });
    expect(actionsFor(outsider, tenant).read).toBe(false);

    const pub = projectOf('OrganizationUser', ProjectAccess.public);
    expect(actionsFor(outsider, pub)).toEqual({
      read: true,
      operate: false,
      manage: false,
      delete: false,
    });
    expect(actionsFor(coworker, pub).operate).toBe(false);
  });

  it('SpaceUser projects: tenant gives space coworkers read only, never non-space org members', async () => {
    const self = await principal({ userId: uMember.id, spaceRole: Role.member });
    const orgOwner = await principal({ userId: uOwner.id, organizationRole: Role.owner });
    const orgAdminNotInSpace = await principal({
      userId: uCoworker.id,
      organizationRole: Role.admin,
    });
    const spaceAdmin = await principal({ userId: uCoworker.id, spaceRole: Role.admin });
    const spaceViewer = await principal({ userId: uCoworker.id, spaceRole: Role.viewer });

    const priv = projectOf('SpaceUser', ProjectAccess.private);
    expect(actionsFor(self, priv)).toEqual({
      read: true,
      operate: true,
      manage: true,
      delete: true,
    });
    expect(actionsFor(orgOwner, priv)).toEqual({
      read: true,
      operate: false,
      manage: false,
      delete: true,
    });
    expect(actionsFor(spaceAdmin, priv).read).toBe(false);

    const tenant = projectOf('SpaceUser', ProjectAccess.tenant);
    expect(actionsFor(orgAdminNotInSpace, tenant).read).toBe(false);
    expect(actionsFor(spaceAdmin, tenant)).toEqual({
      read: true,
      operate: false,
      manage: false,
      delete: false,
    });
    expect(actionsFor(spaceViewer, tenant)).toEqual({
      read: true,
      operate: false,
      manage: false,
      delete: false,
    });
  });

  it('User projects: tenant behaves like private; public opens read; viewer user token reads private', async () => {
    const owner = await principal({ userId: uOwner.id });
    const other = await principal({ userId: uOutsider.id });
    const viewerToken = createPermissions();
    await installPermissions(viewerToken, [
      { entries: [{ resource: 'db:User', id: uOwner.id, actions: { read: true } }] },
    ]);
    viewerToken.setActor({
      model: ActorModel.Token,
      record: { id: 'tok-u', ownerModel: 'User', userId: uOwner.id },
    });

    const priv = projectOf('User', ProjectAccess.private);
    const tenant = projectOf('User', ProjectAccess.tenant);
    const pub = projectOf('User', ProjectAccess.public);

    expect(actionsFor(owner, priv)).toEqual({
      read: true,
      operate: true,
      manage: true,
      delete: true,
    });
    expect(actionsFor(viewerToken, priv)).toEqual({
      read: true,
      operate: false,
      manage: false,
      delete: false,
    });
    expect(actionsFor(other, priv).read).toBe(false);
    expect(actionsFor(other, tenant).read).toBe(false);
    expect(actionsFor(other, pub)).toEqual({
      read: true,
      operate: false,
      manage: false,
      delete: false,
    });
  });

  it('explicit entitlements open a private project for read or operate', async () => {
    const priv = projectOf('Organization', ProjectAccess.private);
    const granted = await principal({
      userId: uCoworker.id,
      organizationRole: Role.viewer,
      entitlements: [
        {
          resource: 'db:Project',
          anchor: { resource: 'db:Project', id: priv.id },
          actions: { operate: true },
        },
      ],
    });
    expect(actionsFor(granted, priv)).toEqual({
      read: true,
      operate: true,
      manage: false,
      delete: false,
    });
  });
});
