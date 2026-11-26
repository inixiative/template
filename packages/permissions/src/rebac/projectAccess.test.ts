import { describe, expect, it } from 'bun:test';
import type { HydratedRecord } from '@template/db';
import { OperateAccess, ReadAccess, Role } from '@template/db/generated/client/enums';
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

const org = { id: 'org-1' };
const otherOrg = { id: 'org-2' };
const space = { id: 'space-1', organizationId: org.id, organization: org };
const otherSpace = { id: 'space-2', organizationId: org.id, organization: org };

const uOwner = { id: 'u-owner' };
const uMember = { id: 'u-member' };
const uCoworker = { id: 'u-coworker' };
const uOutsider = { id: 'u-outsider' };

const orgMemberRow = {
  id: 'ou-member',
  organizationId: org.id,
  userId: uMember.id,
  organization: org,
  user: uMember,
};

const spaceMemberRow = {
  id: 'su-member',
  organizationId: org.id,
  spaceId: space.id,
  userId: uMember.id,
  organization: org,
  space,
  user: uMember,
  organizationUser: orgMemberRow,
};

type PrincipalSpec = {
  userId?: string;
  organizationRole?: Role;
  spaceRole?: Role;
  otherOrganizationRole?: Role;
  asToken?: boolean;
  entitlements?: EntitlementEntry[];
};

const principal = async (spec: PrincipalSpec = {}): Promise<Permix> => {
  const permix = createPermissions();
  const entries = permissionsOfUser(
    spec.asToken ? null : (spec.userId ?? null),
    [
      ...(spec.organizationRole
        ? [
            {
              id: `ou-${spec.userId ?? 'anon'}`,
              organizationId: org.id,
              role: spec.organizationRole,
            },
          ]
        : []),
      ...(spec.otherOrganizationRole
        ? [
            {
              id: `ou-other-${spec.userId ?? 'anon'}`,
              organizationId: otherOrg.id,
              role: spec.otherOrganizationRole,
            },
          ]
        : []),
    ],
    spec.spaceRole
      ? [{ id: `su-${spec.userId ?? 'anon'}`, spaceId: space.id, role: spec.spaceRole }]
      : [],
  );
  await installPermissions(permix, [
    ...entries,
    ...(spec.entitlements?.length
      ? [{ entries: spec.entitlements, owner: organizationOwnerPermissions(org.id) }]
      : []),
  ]);
  if (spec.asToken) {
    permix.setActor({
      model: ActorModel.Token,
      record: { id: 'tok-1', ownerModel: 'Organization', organizationId: otherOrg.id },
    });
  } else if (spec.userId) {
    permix.setActor({ model: ActorModel.User, record: { id: spec.userId } });
  }
  return permix;
};

const actionsFor = (permix: Permix, record: Record<string, unknown>) => ({
  read: check(permix, 'project', record as HydratedRecord, 'read'),
  operate: check(permix, 'project', record as HydratedRecord, 'operate'),
  manage: check(permix, 'project', record as HydratedRecord, 'manage'),
  delete: check(permix, 'project', record as HydratedRecord, 'delete'),
});

const projectOf = (
  ownerModel: 'User' | 'Organization' | 'Space' | 'OrganizationUser' | 'SpaceUser',
  readAccess: ReadAccess,
  operateAccess: OperateAccess = OperateAccess.private,
) => {
  const tag = `${readAccess}-${operateAccess}`;
  switch (ownerModel) {
    case 'User':
      return {
        id: `p-user-${tag}`,
        readAccess,
        operateAccess,
        ownerModel,
        userId: uOwner.id,
        user: uOwner,
      };
    case 'Organization':
      return {
        id: `p-org-${tag}`,
        readAccess,
        operateAccess,
        ownerModel,
        organizationId: org.id,
        organization: org,
      };
    case 'Space':
      return {
        id: `p-space-${tag}`,
        readAccess,
        operateAccess,
        ownerModel,
        organizationId: org.id,
        spaceId: space.id,
        organization: org,
        space,
      };
    case 'OrganizationUser':
      return {
        id: `p-ou-${tag}`,
        readAccess,
        operateAccess,
        ownerModel,
        organizationId: org.id,
        userId: uMember.id,
        organization: org,
        user: uMember,
        organizationUser: orgMemberRow,
      };
    case 'SpaceUser':
      return {
        id: `p-su-${tag}`,
        readAccess,
        operateAccess,
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

describe('db:Project access (ReadAccess × OperateAccess)', () => {
  it('Organization projects support all combinations independently: private, internal read-only, team workspace, member-only, public showcase, and public team workspace', async () => {
    const anon = await principal();
    const outsider = await principal({ userId: uOutsider.id, otherOrganizationRole: Role.owner });
    const foreignToken = await principal({ otherOrganizationRole: Role.owner, asToken: true });
    const viewer = await principal({ userId: uCoworker.id, organizationRole: Role.viewer });
    const member = await principal({ userId: uMember.id, organizationRole: Role.member });
    const admin = await principal({ userId: uOwner.id, organizationRole: Role.admin });

    const priv = projectOf('Organization', ReadAccess.private, OperateAccess.private);
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

    const tenantReadOnly = projectOf('Organization', ReadAccess.tenant, OperateAccess.private);
    expect(actionsFor(anon, tenantReadOnly).read).toBe(false);
    expect(actionsFor(outsider, tenantReadOnly).read).toBe(false);
    expect(actionsFor(viewer, tenantReadOnly)).toEqual({
      read: true,
      operate: false,
      manage: false,
      delete: false,
    });
    expect(actionsFor(member, tenantReadOnly)).toEqual({
      read: true,
      operate: false,
      manage: false,
      delete: false,
    });
    expect(actionsFor(admin, tenantReadOnly)).toEqual({
      read: true,
      operate: true,
      manage: true,
      delete: true,
    });

    const teamWorkspace = projectOf('Organization', ReadAccess.tenant, OperateAccess.tenant);
    expect(actionsFor(viewer, teamWorkspace)).toEqual({
      read: true,
      operate: false,
      manage: false,
      delete: false,
    });
    expect(actionsFor(member, teamWorkspace)).toEqual({
      read: true,
      operate: true,
      manage: false,
      delete: false,
    });

    const membersOnly = projectOf('Organization', ReadAccess.private, OperateAccess.tenant);
    expect(actionsFor(viewer, membersOnly)).toEqual({
      read: false,
      operate: false,
      manage: false,
      delete: false,
    });
    expect(actionsFor(member, membersOnly)).toEqual({
      read: true,
      operate: true,
      manage: false,
      delete: false,
    });

    const publicShowcase = projectOf('Organization', ReadAccess.public, OperateAccess.private);
    expect(actionsFor(anon, publicShowcase)).toEqual({
      read: true,
      operate: false,
      manage: false,
      delete: false,
    });
    expect(actionsFor(outsider, publicShowcase)).toEqual({
      read: true,
      operate: false,
      manage: false,
      delete: false,
    });
    expect(actionsFor(foreignToken, publicShowcase)).toEqual({
      read: true,
      operate: false,
      manage: false,
      delete: false,
    });
    expect(actionsFor(member, publicShowcase)).toEqual({
      read: true,
      operate: false,
      manage: false,
      delete: false,
    });

    const publicTeam = projectOf('Organization', ReadAccess.public, OperateAccess.tenant);
    expect(actionsFor(anon, publicTeam)).toEqual({
      read: true,
      operate: false,
      manage: false,
      delete: false,
    });
    expect(actionsFor(foreignToken, publicTeam)).toEqual({
      read: true,
      operate: false,
      manage: false,
      delete: false,
    });
    expect(actionsFor(viewer, publicTeam)).toEqual({
      read: true,
      operate: false,
      manage: false,
      delete: false,
    });
    expect(actionsFor(member, publicTeam)).toEqual({
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

    const priv = projectOf('Space', ReadAccess.private, OperateAccess.private);
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

    const spaceTenantRead = projectOf('Space', ReadAccess.tenant, OperateAccess.private);
    expect(actionsFor(orgViewer, spaceTenantRead).read).toBe(false);
    expect(actionsFor(orgAdmin, spaceTenantRead).read).toBe(false);
    expect(actionsFor(spaceViewer, spaceTenantRead)).toEqual({
      read: true,
      operate: false,
      manage: false,
      delete: false,
    });
    expect(actionsFor(spaceMember, spaceTenantRead)).toEqual({
      read: true,
      operate: false,
      manage: false,
      delete: false,
    });

    const spaceTenantOperate = projectOf('Space', ReadAccess.private, OperateAccess.tenant);
    expect(actionsFor(orgAdmin, spaceTenantOperate).read).toBe(false);
    expect(actionsFor(spaceViewer, spaceTenantOperate).read).toBe(false);
    expect(actionsFor(spaceMember, spaceTenantOperate)).toEqual({
      read: true,
      operate: true,
      manage: false,
      delete: false,
    });

    const siblingSpaceTenant = {
      id: 'p-space-sibling-tenant',
      readAccess: ReadAccess.tenant,
      operateAccess: OperateAccess.tenant,
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

  it('OrganizationUser projects: readAccess=tenant opens coworker read; operateAccess=tenant lets member+ coworkers operate without granting manage/delete', async () => {
    const self = await principal({ userId: uMember.id, organizationRole: Role.member });
    const orgOwner = await principal({ userId: uOwner.id, organizationRole: Role.owner });
    const orgAdmin = await principal({ userId: uCoworker.id, organizationRole: Role.admin });
    const coworkerMember = await principal({ userId: uCoworker.id, organizationRole: Role.member });
    const coworkerViewer = await principal({ userId: uCoworker.id, organizationRole: Role.viewer });
    const outsider = await principal({ userId: uOutsider.id });

    const priv = projectOf('OrganizationUser', ReadAccess.private, OperateAccess.private);
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
    expect(actionsFor(coworkerViewer, priv).read).toBe(false);

    const tenantRead = projectOf('OrganizationUser', ReadAccess.tenant, OperateAccess.private);
    expect(actionsFor(orgAdmin, tenantRead)).toEqual({
      read: true,
      operate: false,
      manage: false,
      delete: false,
    });
    expect(actionsFor(coworkerMember, tenantRead)).toEqual({
      read: true,
      operate: false,
      manage: false,
      delete: false,
    });
    expect(actionsFor(coworkerViewer, tenantRead)).toEqual({
      read: true,
      operate: false,
      manage: false,
      delete: false,
    });
    expect(actionsFor(outsider, tenantRead).read).toBe(false);

    const tenantOperate = projectOf('OrganizationUser', ReadAccess.private, OperateAccess.tenant);
    expect(actionsFor(coworkerViewer, tenantOperate)).toEqual({
      read: false,
      operate: false,
      manage: false,
      delete: false,
    });
    expect(actionsFor(coworkerMember, tenantOperate)).toEqual({
      read: true,
      operate: true,
      manage: false,
      delete: false,
    });
    expect(actionsFor(orgAdmin, tenantOperate)).toEqual({
      read: true,
      operate: true,
      manage: false,
      delete: false,
    });
    expect(actionsFor(outsider, tenantOperate).read).toBe(false);

    const pub = projectOf('OrganizationUser', ReadAccess.public, OperateAccess.private);
    expect(actionsFor(outsider, pub)).toEqual({
      read: true,
      operate: false,
      manage: false,
      delete: false,
    });
    expect(actionsFor(coworkerMember, pub).operate).toBe(false);
  });

  it('SpaceUser projects: tenant read/operate stay scoped to space coworkers, never non-space org members', async () => {
    const self = await principal({ userId: uMember.id, spaceRole: Role.member });
    const orgOwner = await principal({ userId: uOwner.id, organizationRole: Role.owner });
    const orgAdminNotInSpace = await principal({
      userId: uCoworker.id,
      organizationRole: Role.admin,
    });
    const spaceAdmin = await principal({ userId: uCoworker.id, spaceRole: Role.admin });
    const spaceMember = await principal({ userId: uCoworker.id, spaceRole: Role.member });
    const spaceViewer = await principal({ userId: uCoworker.id, spaceRole: Role.viewer });

    const priv = projectOf('SpaceUser', ReadAccess.private, OperateAccess.private);
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

    const tenantRead = projectOf('SpaceUser', ReadAccess.tenant, OperateAccess.private);
    expect(actionsFor(orgAdminNotInSpace, tenantRead).read).toBe(false);
    expect(actionsFor(spaceAdmin, tenantRead)).toEqual({
      read: true,
      operate: false,
      manage: false,
      delete: false,
    });
    expect(actionsFor(spaceViewer, tenantRead)).toEqual({
      read: true,
      operate: false,
      manage: false,
      delete: false,
    });

    const tenantOperate = projectOf('SpaceUser', ReadAccess.private, OperateAccess.tenant);
    expect(actionsFor(orgAdminNotInSpace, tenantOperate).read).toBe(false);
    expect(actionsFor(spaceViewer, tenantOperate).read).toBe(false);
    expect(actionsFor(spaceMember, tenantOperate)).toEqual({
      read: true,
      operate: true,
      manage: false,
      delete: false,
    });
    expect(actionsFor(spaceAdmin, tenantOperate)).toEqual({
      read: true,
      operate: true,
      manage: false,
      delete: false,
    });
  });

  it('User projects: private is owner-only, public opens read only, viewer user token reads private', async () => {
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

    const priv = projectOf('User', ReadAccess.private, OperateAccess.private);
    const bypassedTenant = projectOf('User', ReadAccess.tenant, OperateAccess.tenant);
    const pub = projectOf('User', ReadAccess.public, OperateAccess.private);

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
    expect(actionsFor(other, bypassedTenant)).toEqual({
      read: false,
      operate: false,
      manage: false,
      delete: false,
    });
    expect(actionsFor(other, pub)).toEqual({
      read: true,
      operate: false,
      manage: false,
      delete: false,
    });
  });

  it('explicit entitlements open a private project for read or operate', async () => {
    const priv = projectOf('Organization', ReadAccess.private, OperateAccess.private);
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
