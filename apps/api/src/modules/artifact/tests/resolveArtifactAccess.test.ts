import { beforeEach, describe, expect, it } from 'bun:test';
import { db, fetchCachedRecordWithTargetEntitlements, hydrate } from '@template/db';
import type { Artifact, Organization, Space, User } from '@template/db/generated/client/client';
import type {
  PlacementOperateAccess,
  PlacementReadAccess,
  Role,
} from '@template/db/generated/client/enums';
import {
  createArtifact,
  createArtifactPermission,
  createArtifactPlacement,
  createOrganization,
  createOrganizationUser,
  createSpace,
  createSpaceUser,
  createToken,
  createUser,
} from '@template/db/test';
import { artifactEffectiveRole, delegate, permissionsOfUser } from '@template/permissions';
import { createPermissions, installPermissions } from '@template/permissions/client';
import { check, schemaMap } from '@template/permissions/rebac';
import { actionsTenantMayExtend } from '@template/permissions/rebac/tenantPermissionRulesLens';
import { ARTIFACT_MAX_DEPTH } from '@template/shared/artifact';
import { fetchOwnerRootArtifactOrThrow } from '#/modules/artifact/services/artifactOwner';

const folderOf = async (
  organization: Organization,
  readAccess?: PlacementReadAccess,
  operateAccess?: PlacementOperateAccess,
): Promise<Artifact> => {
  const folder = (
    await createArtifact({
      kind: 'folder',
      ownerModel: 'Organization',
      organizationId: organization.id,
    })
  ).entity;
  if (readAccess || operateAccess) {
    const root = await fetchOwnerRootArtifactOrThrow({
      ownerModel: 'Organization',
      organizationId: organization.id,
    });
    await createArtifactPlacement({
      artifactId: folder.id,
      containerArtifactId: root.id,
      ...(readAccess ? { readAccess } : {}),
      ...(operateAccess ? { operateAccess } : {}),
    });
    return db.artifact.findUniqueOrThrow({ where: { id: folder.id } });
  }
  return folder;
};

const place = async (
  member: Artifact,
  container: Artifact,
  readAccess: PlacementReadAccess = 'inherit',
  operateAccess: PlacementOperateAccess = 'inherit',
) => {
  const placement = (
    await createArtifactPlacement({
      artifactId: member.id,
      containerArtifactId: container.id,
      readAccess,
      operateAccess,
    })
  ).entity;
  const refreshed = await db.artifact.findUniqueOrThrow({ where: { id: member.id } });
  return { artifact: refreshed, placement };
};

const permixForUser = (
  user: User,
  orgs: { id: string; role: Role }[] = [],
  spaces: { id: string; role: Role }[] = [],
) => {
  const permix = createPermissions();
  permix.setActor({ model: 'User', record: user });
  installPermissions(
    permix,
    permissionsOfUser(
      user.id,
      orgs.map(({ id, role }) => ({ organizationId: id, role })),
      spaces.map(({ id, role }) => ({ spaceId: id, role })),
    ),
  );
  return permix;
};

describe('artifact ReBAC & closure inheritance', () => {
  let organization: Organization;
  let space: Space;
  let reader: User;

  beforeEach(async () => {
    organization = (await createOrganization()).entity;
    space = (await createSpace({}, { organization })).entity;
    reader = (await createUser()).entity;
  });

  it('an inherit placement takes the union of its containers: adding to a public folder makes it public, removing revokes it', async () => {
    const shared = await folderOf(organization, 'public');
    const internal = await folderOf(organization);
    await createArtifactPermission({
      artifactId: internal.id,
      granteeModel: 'Space',
      granteeSpaceId: space.id,
      role: 'member',
    });
    let file = await folderOf(organization);
    file = (await place(file, internal)).artifact;
    expect(file.effectiveReadAccess).toBe('private');
    expect(file.effectiveOperateAccess).toBe('private');

    const { artifact: inPublic, placement: publicEdge } = await place(file, shared);
    expect(inPublic.effectiveReadAccess).toBe('public');
    expect(inPublic.effectiveOperateAccess).toBe('private');
    const hydrated = await hydrate('artifact', inPublic);
    const spaceMember = permixForUser(reader, [], [{ id: space.id, role: 'member' }]);
    expect(artifactEffectiveRole(spaceMember, hydrated)).toBe('member');

    // Removing the public placement immediately drops effectiveReadAccess back to private
    await db.artifactPlacement.delete({ where: { id: publicEdge.id } });
    const afterRemove = await db.artifact.findUniqueOrThrow({ where: { id: file.id } });
    expect(afterRemove.effectiveReadAccess).toBe('private');
  });

  it('a private placement inside a public folder takes nothing from its container', async () => {
    const shared = await folderOf(organization, 'public');
    await createArtifactPermission({
      artifactId: shared.id,
      granteeModel: 'User',
      granteeUserId: reader.id,
      role: 'viewer',
    });
    const { artifact: secret } = await place(await folderOf(organization), shared, 'private');

    const hydrated = await hydrate('artifact', secret);
    expect(secret.effectiveReadAccess).toBe('private');
    expect(artifactEffectiveRole(permixForUser(reader), hydrated)).toBeNull();
    const orgOwner = permixForUser(reader, [{ id: organization.id, role: 'owner' }]);
    expect(artifactEffectiveRole(orgOwner, hydrated)).toBe('owner');
  });

  it('a public placement adds public read and still inherits its container grants', async () => {
    const team = await folderOf(organization);
    await createArtifactPermission({
      artifactId: team.id,
      granteeModel: 'User',
      granteeUserId: reader.id,
      role: 'admin',
    });
    const { artifact: page } = await place(await folderOf(organization), team, 'public');

    const hydrated = await hydrate('artifact', page);
    expect(page.effectiveReadAccess).toBe('public');
    expect(artifactEffectiveRole(permixForUser(reader), hydrated)).toBe('admin');
  });

  it('grants pass down through inherit levels and stop at a private placement', async () => {
    const top = await folderOf(organization);
    await createArtifactPermission({
      artifactId: top.id,
      granteeModel: 'User',
      granteeUserId: reader.id,
      role: 'viewer',
    });
    const { artifact: middle, placement: middleEdge } = await place(
      await folderOf(organization),
      top,
    );
    const { artifact: leaf } = await place(await folderOf(organization), middle);
    const readerPermix = permixForUser(reader);
    expect(artifactEffectiveRole(readerPermix, await hydrate('artifact', leaf))).toBe('viewer');

    await db.artifactPlacement.update({
      where: { id: middleEdge.id },
      data: { readAccess: 'private' },
    });
    expect(artifactEffectiveRole(readerPermix, await hydrate('artifact', leaf))).toBeNull();
  });

  it('a file at depth ARTIFACT_MAX_DEPTH still takes its top grant in one hop', async () => {
    const top = await folderOf(organization);
    await createArtifactPermission({
      artifactId: top.id,
      granteeModel: 'User',
      granteeUserId: reader.id,
      role: 'viewer',
    });
    let parent = top;
    for (let level = 0; level < ARTIFACT_MAX_DEPTH; level++) {
      parent = (await place(await folderOf(organization), parent)).artifact;
    }
    const { entity: file } = await createArtifact({
      kind: 'file',
      ownerModel: 'Organization',
      organizationId: organization.id,
    });
    const { artifact: leaf } = await place(file, parent);
    expect(artifactEffectiveRole(permixForUser(reader), await hydrate('artifact', leaf))).toBe(
      'viewer',
    );
  }, 15_000);

  it('an expired grant gives nothing, evaluated live against the clock', async () => {
    const folder = await folderOf(organization);
    await createArtifactPermission({
      artifactId: folder.id,
      granteeModel: 'User',
      granteeUserId: reader.id,
      role: 'viewer',
      expiresAt: new Date(Date.now() - 1_000),
    });
    expect(
      artifactEffectiveRole(permixForUser(reader), await hydrate('artifact', folder)),
    ).toBeNull();
  });

  it('5-way OrganizationUser and SpaceUser artifacts give owner break-glass read/delete only', async () => {
    const { entity: orgUser, context: orgUserCtx } = await createOrganizationUser(
      { role: 'member' },
      { organization },
    );
    const { context: spaceUserCtx } = await createSpaceUser(
      { role: 'member' },
      { organization, space, organizationUser: orgUser, user: orgUserCtx.user },
    );
    const orgMemberArtifact: Artifact = (
      await createArtifact({
        kind: 'file',
        ownerModel: 'OrganizationUser',
        organizationId: organization.id,
        userId: orgUserCtx.user.id,
      })
    ).entity;
    const spaceMemberArtifact: Artifact = (
      await createArtifact({
        kind: 'file',
        ownerModel: 'SpaceUser',
        organizationId: organization.id,
        spaceId: space.id,
        userId: spaceUserCtx.user.id,
      })
    ).entity;

    const selfPermix = permixForUser(
      orgUserCtx.user,
      [{ id: organization.id, role: 'member' }],
      [{ id: space.id, role: 'member' }],
    );
    const orgOwnerPermix = permixForUser(reader, [{ id: organization.id, role: 'owner' }]);
    const orgAdminPermix = permixForUser(reader, [{ id: organization.id, role: 'admin' }]);

    for (const artifact of [orgMemberArtifact, spaceMemberArtifact]) {
      const hydrated = await hydrate('artifact', artifact);
      expect(check(selfPermix, 'artifact', hydrated, 'own')).toBe(true);
      expect(check(orgOwnerPermix, 'artifact', hydrated, 'read')).toBe(true);
      expect(check(orgOwnerPermix, 'artifact', hydrated, 'delete')).toBe(true);
      expect(check(orgOwnerPermix, 'artifact', hydrated, 'manage')).toBe(false);
      expect(check(orgAdminPermix, 'artifact', hydrated, 'read')).toBe(false);
    }
  });

  it('tenantPermissionRules on Organization widens Organization artifacts without leaking private member workspaces or delete', async () => {
    const folder = await folderOf(organization);
    const { context: orgUserCtx } = await createOrganizationUser(
      { role: 'member' },
      { organization },
    );
    const privateMemberArtifact: Artifact = (
      await createArtifact({
        kind: 'file',
        ownerModel: 'OrganizationUser',
        organizationId: organization.id,
        userId: orgUserCtx.user.id,
      })
    ).entity;
    const memberPermix = permixForUser(reader, [{ id: organization.id, role: 'member' }]);
    expect(check(memberPermix, 'artifact', await hydrate('artifact', folder), 'read')).toBe(false);

    await db.organization.update({
      where: { id: organization.id },
      data: {
        tenantPermissionRules: {
          'db:Artifact': { read: { rel: 'organization', action: 'read' } },
        },
      },
    });
    expect(check(memberPermix, 'artifact', await hydrate('artifact', folder), 'read')).toBe(true);
    expect(
      check(memberPermix, 'artifact', await hydrate('artifact', privateMemberArtifact), 'read'),
    ).toBe(false);
    expect(actionsTenantMayExtend('Organization', 'db:Artifact')).not.toContain('own');
    expect(actionsTenantMayExtend('Organization', 'db:Artifact')).not.toContain('delete');
  });

  it('admin-capped User token gets manage but not own or delete on member-owned and member-granted artifacts', async () => {
    const { context: orgUserCtx } = await createOrganizationUser(
      { role: 'member' },
      { organization },
    );
    const memberOwned = (
      await createArtifact({
        kind: 'file',
        ownerModel: 'OrganizationUser',
        organizationId: organization.id,
        userId: orgUserCtx.user.id,
      })
    ).entity;
    const orgFolder = await folderOf(organization);
    await createArtifactPermission({
      artifactId: orgFolder.id,
      granteeModel: 'OrganizationUser',
      granteeOrganizationId: organization.id,
      granteeUserId: orgUserCtx.user.id,
      role: 'owner',
    });

    const { entity: adminUserToken } = await createToken({
      ownerModel: 'User',
      userId: orgUserCtx.user.id,
      full: false,
      role: 'admin',
    });
    const permix = createPermissions();
    permix.setActor({ model: 'Token', record: adminUserToken });
    const base = permissionsOfUser(
      orgUserCtx.user.id,
      [{ organizationId: organization.id, role: 'member' }],
      [],
    );
    await installPermissions(permix, delegate(schemaMap, base, { ceiling: 'manage' }));

    for (const artifact of [memberOwned, orgFolder]) {
      const hydrated = await hydrate('artifact', artifact);
      expect(check(permix, 'artifact', hydrated, 'manage')).toBe(true);
      expect(check(permix, 'artifact', hydrated, 'own')).toBe(false);
      expect(check(permix, 'artifact', hydrated, 'delete')).toBe(false);
    }
  });

  it('closure hooks stay live-scoped inside db.withDeleted (revive never resurrects revoked grants or placements)', async () => {
    const parent = await folderOf(organization, 'public');
    const child = await folderOf(organization);
    const placement = (
      await createArtifactPlacement({
        artifactId: child.id,
        containerArtifactId: parent.id,
      })
    ).entity;
    const perm = (
      await createArtifactPermission({
        artifactId: child.id,
        granteeModel: 'User',
        granteeUserId: reader.id,
        role: 'admin',
      })
    ).entity;

    // Revoke permission inside withDeleted: effective row must be removed immediately.
    await db.withDeleted(() =>
      db.artifactPermission.update({ where: { id: perm.id }, data: { deletedAt: new Date() } }),
    );
    expect(
      await db.artifactEffectivePermission.count({ where: { artifactPermissionId: perm.id } }),
    ).toBe(0);

    // Remove placement before tombstoning child, then tombstone and revive child inside withDeleted.
    await db.artifactPlacement.delete({ where: { id: placement.id } });
    await db.artifact.update({ where: { id: child.id }, data: { deletedAt: new Date() } });
    const revived = await db.withDeleted(() =>
      db.artifact.update({ where: { id: child.id }, data: { deletedAt: null } }),
    );

    // Removing the last folder placement reparents child privately to root; reviving child keeps that root placement and never resurrects parent or perm.
    expect(
      await db.artifactAncestor.count({
        where: { artifactId: child.id, ancestorArtifactId: parent.id },
      }),
    ).toBe(0);
    expect(
      await db.artifactAncestor.count({
        where: { artifactId: child.id, ancestorArtifact: { kind: 'root' } },
      }),
    ).toBe(1);
    expect(await db.artifactEffectivePermission.count({ where: { artifactId: child.id } })).toBe(0);
    expect(revived.effectiveReadAccess).toBe('private');
    expect(revived.effectiveOperateAccess).toBe('private');
    expect(
      artifactEffectiveRole(permixForUser(reader), await hydrate('artifact', revived)),
    ).toBeNull();
  });

  it('direct fetchCachedRecordWithTargetEntitlements populates artifactEffectivePermissions down list so hydrate succeeds', async () => {
    const folder = await folderOf(organization);
    const cached = await fetchCachedRecordWithTargetEntitlements('artifact', folder.id);
    expect(cached).not.toBeNull();
    const hydrated = await hydrate('artifact', folder);
    expect(Array.isArray(hydrated.artifactEffectivePermissions)).toBe(true);
  });

  it('eager ownerRootArtifact hook provisions root containers on owner creation and skips rows created soft-deleted', async () => {
    const userRoot = await db.artifact.findFirst({
      where: { ownerModel: 'User', userId: reader.id, kind: 'root' },
    });
    const orgRoot = await db.artifact.findFirst({
      where: { ownerModel: 'Organization', organizationId: organization.id, kind: 'root' },
    });
    const spaceRoot = await db.artifact.findFirst({
      where: {
        ownerModel: 'Space',
        organizationId: organization.id,
        spaceId: space.id,
        kind: 'root',
      },
    });
    expect(userRoot).not.toBeNull();
    expect(orgRoot).not.toBeNull();
    expect(spaceRoot).not.toBeNull();

    const deletedUser = (await createUser({ deletedAt: new Date() })).entity;
    const deletedUserRoot = await db.withDeleted(() =>
      db.artifact.findFirst({
        where: { ownerModel: 'User', userId: deletedUser.id, kind: 'root' },
      }),
    );
    expect(deletedUserRoot).toBeNull();

    // Upsert reviving a tombstoned OrganizationUser (e.g. inviteOrganizationUser after transferSpace) provisions its root.
    const rehiredUser = (await createUser()).entity;
    const tombstonedSeat = (
      await createOrganizationUser(
        { role: 'member', deletedAt: new Date() },
        { organization, user: rehiredUser },
      )
    ).entity;
    expect(
      await db.withDeleted(() =>
        db.artifact.findFirst({
          where: {
            ownerModel: 'OrganizationUser',
            organizationId: organization.id,
            userId: rehiredUser.id,
            kind: 'root',
          },
        }),
      ),
    ).toBeNull();
    await db.withDeleted(() =>
      db.organizationUser.upsert({
        where: { id: tombstonedSeat.id },
        create: {
          organizationId: organization.id,
          userId: rehiredUser.id,
          role: 'member',
        },
        update: { deletedAt: null },
      }),
    );
    const revivedSeatRoot = await db.artifact.findFirst({
      where: {
        ownerModel: 'OrganizationUser',
        organizationId: organization.id,
        userId: rehiredUser.id,
        kind: 'root',
      },
    });
    expect(revivedSeatRoot).not.toBeNull();
  });

  it('tenant access grants read to tenant members (including inherited and member workspaces) but never outsiders or User artifacts', async () => {
    const orgTenantFolder = await folderOf(organization, 'tenant');
    const { artifact: inheritedChild } = await place(await folderOf(organization), orgTenantFolder);
    const orgMemberPermix = permixForUser(reader, [{ id: organization.id, role: 'member' }]);
    const outsiderPermix = permixForUser(reader);

    const hydratedChild = await hydrate('artifact', inheritedChild);
    expect(inheritedChild.effectiveReadAccess).toBe('tenant');
    expect(inheritedChild.effectiveOperateAccess).toBe('private');
    expect(check(orgMemberPermix, 'artifact', hydratedChild, 'read')).toBe(true);
    expect(check(orgMemberPermix, 'artifact', hydratedChild, 'operate')).toBe(false);
    expect(check(outsiderPermix, 'artifact', hydratedChild, 'read')).toBe(false);
    expect(artifactEffectiveRole(orgMemberPermix, hydratedChild)).toBeNull();

    // Multi-parent precedence: public > tenant > private
    const pubFolder = await folderOf(organization, 'public');
    const { artifact: nowPublic } = await place(inheritedChild, pubFolder);
    expect(nowPublic.effectiveReadAccess).toBe('public');

    // Cache invalidates on parent placement flipping tenant -> private
    const orgRoot = await fetchOwnerRootArtifactOrThrow({
      ownerModel: 'Organization',
      organizationId: organization.id,
    });
    const soloParent = await folderOf(organization);
    const { placement: soloRootEdge } = await place(soloParent, orgRoot, 'tenant');
    const { artifact: soloChild } = await place(await folderOf(organization), soloParent);
    expect(check(orgMemberPermix, 'artifact', await hydrate('artifact', soloChild), 'read')).toBe(
      true,
    );
    await db.artifactPlacement.update({
      where: { id: soloRootEdge.id },
      data: { readAccess: 'private' },
    });
    const refreshedSoloChild = await db.artifact.findUniqueOrThrow({ where: { id: soloChild.id } });
    expect(refreshedSoloChild.effectiveReadAccess).toBe('private');
    expect(
      check(orgMemberPermix, 'artifact', await hydrate('artifact', refreshedSoloChild), 'read'),
    ).toBe(false);

    // OrganizationUser tenant placement is readable by org peers, not outsiders
    const { context: peerCtx } = await createOrganizationUser({ role: 'member' }, { organization });
    const peerRoot = await fetchOwnerRootArtifactOrThrow({
      ownerModel: 'OrganizationUser',
      organizationId: organization.id,
      userId: peerCtx.user.id,
    });
    const { artifact: memberDraft } = await place(
      (
        await createArtifact({
          kind: 'file',
          ownerModel: 'OrganizationUser',
          organizationId: organization.id,
          userId: peerCtx.user.id,
        })
      ).entity,
      peerRoot,
      'tenant',
    );
    expect(check(orgMemberPermix, 'artifact', await hydrate('artifact', memberDraft), 'read')).toBe(
      true,
    );
    expect(check(outsiderPermix, 'artifact', await hydrate('artifact', memberDraft), 'read')).toBe(
      false,
    );

    // Space tenant placement is readable by space members, not non-space org members
    const spaceRoot = await fetchOwnerRootArtifactOrThrow({
      ownerModel: 'Space',
      organizationId: organization.id,
      spaceId: space.id,
    });
    const { artifact: spaceDoc } = await place(
      (
        await createArtifact({
          kind: 'file',
          ownerModel: 'Space',
          organizationId: organization.id,
          spaceId: space.id,
        })
      ).entity,
      spaceRoot,
      'tenant',
    );
    const spaceMemberPermix = permixForUser(
      reader,
      [{ id: organization.id, role: 'member' }],
      [{ id: space.id, role: 'member' }],
    );
    expect(check(spaceMemberPermix, 'artifact', await hydrate('artifact', spaceDoc), 'read')).toBe(
      true,
    );
    expect(check(orgMemberPermix, 'artifact', await hydrate('artifact', spaceDoc), 'read')).toBe(
      false,
    );

    // Even if written directly at the DB layer, ownerTenant excludes User so outsiders never gain read
    const userRoot = await fetchOwnerRootArtifactOrThrow({
      ownerModel: 'User',
      userId: peerCtx.user.id,
    });
    const { artifact: userDoc } = await place(
      (
        await createArtifact({
          kind: 'file',
          ownerModel: 'User',
          userId: peerCtx.user.id,
        })
      ).entity,
      userRoot,
      'tenant',
      'tenant',
    );
    expect(check(outsiderPermix, 'artifact', await hydrate('artifact', userDoc), 'read')).toBe(
      false,
    );
    expect(check(outsiderPermix, 'artifact', await hydrate('artifact', userDoc), 'operate')).toBe(
      false,
    );

    // public parent -> tenant placement child -> inherit grandchild: stops BOTH public visibility AND parent folder external grants
    const pubTop = await folderOf(organization, 'public');
    await createArtifactPermission({
      artifactId: pubTop.id,
      granteeModel: 'User',
      granteeUserId: reader.id,
      role: 'admin',
    });
    const { artifact: tenantMid } = await place(await folderOf(organization), pubTop, 'tenant');
    const { artifact: inheritLeaf } = await place(await folderOf(organization), tenantMid);
    const hydratedLeaf = await hydrate('artifact', inheritLeaf);
    expect(inheritLeaf.effectiveReadAccess).toBe('tenant');
    expect(check(outsiderPermix, 'artifact', hydratedLeaf, 'read')).toBe(false);
    expect(check(orgMemberPermix, 'artifact', hydratedLeaf, 'read')).toBe(true);
    const stranger = (await createUser()).entity;
    expect(check(permixForUser(stranger), 'artifact', hydratedLeaf, 'read')).toBe(false);
  });

  it('operateAccess: tenant grants operate (and implied read) to tenant members, never viewers or outsiders; public never grants operate', async () => {
    const orgMemberPermix = permixForUser(reader, [{ id: organization.id, role: 'member' }]);
    const orgViewerPermix = permixForUser(reader, [{ id: organization.id, role: 'viewer' }]);
    const outsiderPermix = permixForUser(reader);

    // readAccess: 'private', operateAccess: 'tenant' -> org member reads & operates; viewer gets neither
    const teamFolder = await folderOf(organization, 'private', 'tenant');
    const { artifact: teamChild } = await place(await folderOf(organization), teamFolder);
    expect(teamFolder.effectiveReadAccess).toBe('private');
    expect(teamFolder.effectiveOperateAccess).toBe('tenant');
    expect(teamChild.effectiveReadAccess).toBe('private');
    expect(teamChild.effectiveOperateAccess).toBe('tenant');

    const hydratedChild = await hydrate('artifact', teamChild);
    expect(check(orgMemberPermix, 'artifact', hydratedChild, 'operate')).toBe(true);
    expect(check(orgMemberPermix, 'artifact', hydratedChild, 'read')).toBe(true);
    expect(check(orgMemberPermix, 'artifact', hydratedChild, 'manage')).toBe(false);
    expect(check(orgViewerPermix, 'artifact', hydratedChild, 'read')).toBe(false);
    expect(check(orgViewerPermix, 'artifact', hydratedChild, 'operate')).toBe(false);
    expect(check(outsiderPermix, 'artifact', hydratedChild, 'read')).toBe(false);
    expect(artifactEffectiveRole(orgMemberPermix, hydratedChild)).toBeNull();

    // readAccess: 'public', operateAccess: 'private' -> public is strictly read-only
    const pubOnly = await folderOf(organization, 'public', 'private');
    const hydratedPub = await hydrate('artifact', pubOnly);
    expect(check(outsiderPermix, 'artifact', hydratedPub, 'read')).toBe(true);
    expect(check(outsiderPermix, 'artifact', hydratedPub, 'operate')).toBe(false);
    expect(check(orgMemberPermix, 'artifact', hydratedPub, 'operate')).toBe(false);

    // Space & SpaceUser operateAccess: 'tenant' -> space member operates; space viewer & non-space org member cannot
    const spaceMemberPermix = permixForUser(
      reader,
      [{ id: organization.id, role: 'member' }],
      [{ id: space.id, role: 'member' }],
    );
    const spaceViewerPermix = permixForUser(
      reader,
      [{ id: organization.id, role: 'member' }],
      [{ id: space.id, role: 'viewer' }],
    );
    const spaceRoot = await fetchOwnerRootArtifactOrThrow({
      ownerModel: 'Space',
      organizationId: organization.id,
      spaceId: space.id,
    });
    const { artifact: spaceShared } = await place(
      (
        await createArtifact({
          kind: 'file',
          ownerModel: 'Space',
          organizationId: organization.id,
          spaceId: space.id,
        })
      ).entity,
      spaceRoot,
      'private',
      'tenant',
    );
    const hydratedSpaceShared = await hydrate('artifact', spaceShared);
    expect(check(spaceMemberPermix, 'artifact', hydratedSpaceShared, 'operate')).toBe(true);
    expect(check(spaceMemberPermix, 'artifact', hydratedSpaceShared, 'read')).toBe(true);
    expect(check(spaceViewerPermix, 'artifact', hydratedSpaceShared, 'read')).toBe(false);
    expect(check(orgMemberPermix, 'artifact', hydratedSpaceShared, 'read')).toBe(false);

    const { entity: orgUser, context: orgUserCtx } = await createOrganizationUser(
      { role: 'member' },
      { organization },
    );
    const { context: spaceUserCtx } = await createSpaceUser(
      { role: 'member' },
      { organization, space, organizationUser: orgUser, user: orgUserCtx.user },
    );
    const spaceUserRoot = await fetchOwnerRootArtifactOrThrow({
      ownerModel: 'SpaceUser',
      organizationId: organization.id,
      spaceId: space.id,
      userId: spaceUserCtx.user.id,
    });
    const { artifact: spacePeerDoc } = await place(
      (
        await createArtifact({
          kind: 'file',
          ownerModel: 'SpaceUser',
          organizationId: organization.id,
          spaceId: space.id,
          userId: spaceUserCtx.user.id,
        })
      ).entity,
      spaceUserRoot,
      'private',
      'tenant',
    );
    const hydratedSpacePeer = await hydrate('artifact', spacePeerDoc);
    expect(check(spaceMemberPermix, 'artifact', hydratedSpacePeer, 'operate')).toBe(true);
    expect(check(spaceViewerPermix, 'artifact', hydratedSpacePeer, 'read')).toBe(false);
    expect(check(orgMemberPermix, 'artifact', hydratedSpacePeer, 'read')).toBe(false);
  });
});
