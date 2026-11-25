import { beforeEach, describe, expect, it } from 'bun:test';
import { db, fetchCachedRecordWithTargetEntitlements } from '@template/db';
import type { Artifact, Organization, Space, User } from '@template/db/generated/client/client';
import type { Role } from '@template/db/generated/client/enums';
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
import { delegate, permissionsOfUser } from '@template/permissions';
import { createPermissions, installPermissions } from '@template/permissions/client';
import { check, schemaMap } from '@template/permissions/rebac';
import { actionsTenantMayExtend } from '@template/permissions/rebac/tenantPermissionRulesLens';
import { ARTIFACT_MAX_DEPTH } from '@template/shared/artifact';
import {
  artifactEffectiveRole,
  effectiveArtifactAccess,
  hydrateArtifact,
  isArtifactPublic,
} from '#/modules/artifact/lib/checkArtifactPermission';

const folderOf = async (
  organization: Organization,
  access?: Artifact['access'],
): Promise<Artifact> =>
  (
    await createArtifact({
      kind: 'folder',
      ownerModel: 'Organization',
      organizationId: organization.id,
      ...(access ? { access } : {}),
    })
  ).entity;

const place = async (member: Artifact, container: Artifact) => {
  await createArtifactPlacement({
    ownerModel: container.ownerModel,
    userId: container.userId,
    organizationId: container.organizationId,
    spaceId: container.spaceId,
    artifactId: member.id,
    containerArtifactId: container.id,
  });
  return db.artifact.update({ where: { id: member.id }, data: { access: 'inherit' } });
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

  it('an inherit artifact takes the union of its containers: any public container makes it public', async () => {
    const shared = await folderOf(organization, 'public');
    const internal = await folderOf(organization);
    await createArtifactPermission({
      artifactId: internal.id,
      granteeModel: 'Space',
      granteeSpaceId: space.id,
      role: 'member',
    });
    let file = await folderOf(organization);
    file = await place(file, internal);
    expect(isArtifactPublic(await hydrateArtifact(file))).toBe(false);

    file = await place(file, shared);
    const hydrated = await hydrateArtifact(file);
    expect(isArtifactPublic(hydrated)).toBe(true);
    const spaceMember = permixForUser(reader, [], [{ id: space.id, role: 'member' }]);
    expect(artifactEffectiveRole(spaceMember, hydrated)).toBe('member');
  });

  it('an explicit private artifact takes nothing from its containers', async () => {
    const shared = await folderOf(organization, 'public');
    await createArtifactPermission({
      artifactId: shared.id,
      granteeModel: 'User',
      granteeUserId: reader.id,
      role: 'viewer',
    });
    let secret = await folderOf(organization);
    secret = await place(secret, shared);
    secret = await db.artifact.update({ where: { id: secret.id }, data: { access: 'private' } });

    const hydrated = await hydrateArtifact(secret);
    expect(isArtifactPublic(hydrated)).toBe(false);
    expect(artifactEffectiveRole(permixForUser(reader), hydrated)).toBeNull();
    const orgOwner = permixForUser(reader, [{ id: organization.id, role: 'owner' }]);
    expect(artifactEffectiveRole(orgOwner, hydrated)).toBe('owner');
  });

  it('a public artifact adds public read and still inherits its containers grants', async () => {
    const team = await folderOf(organization);
    await createArtifactPermission({
      artifactId: team.id,
      granteeModel: 'User',
      granteeUserId: reader.id,
      role: 'admin',
    });
    let page = await folderOf(organization);
    page = await place(page, team);
    page = await db.artifact.update({ where: { id: page.id }, data: { access: 'public' } });

    const hydrated = await hydrateArtifact(page);
    expect(isArtifactPublic(hydrated)).toBe(true);
    expect(artifactEffectiveRole(permixForUser(reader), hydrated)).toBe('admin');
  });

  it('grants pass down through inherit levels and stop at a private one', async () => {
    const root = await folderOf(organization);
    await createArtifactPermission({
      artifactId: root.id,
      granteeModel: 'User',
      granteeUserId: reader.id,
      role: 'viewer',
    });
    const middle = await place(await folderOf(organization), root);
    const leaf = await place(await folderOf(organization), middle);
    const readerPermix = permixForUser(reader);
    expect(artifactEffectiveRole(readerPermix, await hydrateArtifact(leaf))).toBe('viewer');

    await db.artifact.update({ where: { id: middle.id }, data: { access: 'private' } });
    expect(artifactEffectiveRole(readerPermix, await hydrateArtifact(leaf))).toBeNull();
  });

  it('a file at depth ARTIFACT_MAX_DEPTH still takes its root grant in one hop', async () => {
    const root = await folderOf(organization);
    await createArtifactPermission({
      artifactId: root.id,
      granteeModel: 'User',
      granteeUserId: reader.id,
      role: 'viewer',
    });
    let parent = root;
    for (let level = 0; level < ARTIFACT_MAX_DEPTH; level++) {
      parent = await place(await folderOf(organization), parent);
    }
    const { entity: file } = await createArtifact({
      kind: 'file',
      ownerModel: 'Organization',
      organizationId: organization.id,
    });
    const leaf = await place(file, parent);
    expect(artifactEffectiveRole(permixForUser(reader), await hydrateArtifact(leaf))).toBe(
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
    expect(artifactEffectiveRole(permixForUser(reader), await hydrateArtifact(folder))).toBeNull();
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
    const orgMemberArtifact = (
      await createArtifact({
        kind: 'file',
        ownerModel: 'OrganizationUser',
        organizationId: organization.id,
        userId: orgUserCtx.user.id,
      })
    ).entity;
    const spaceMemberArtifact = (
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
      const hydrated = await hydrateArtifact(artifact);
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
    const privateMemberArtifact = (
      await createArtifact({
        kind: 'file',
        ownerModel: 'OrganizationUser',
        organizationId: organization.id,
        userId: orgUserCtx.user.id,
      })
    ).entity;
    const memberPermix = permixForUser(reader, [{ id: organization.id, role: 'member' }]);
    expect(check(memberPermix, 'artifact', await hydrateArtifact(folder), 'read')).toBe(false);

    await db.organization.update({
      where: { id: organization.id },
      data: {
        tenantPermissionRules: {
          'db:Artifact': { read: { rel: 'organization', action: 'read' } },
        },
      },
    });
    expect(check(memberPermix, 'artifact', await hydrateArtifact(folder), 'read')).toBe(true);
    expect(
      check(memberPermix, 'artifact', await hydrateArtifact(privateMemberArtifact), 'read'),
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
      const hydrated = await hydrateArtifact(artifact);
      expect(check(permix, 'artifact', hydrated, 'manage')).toBe(true);
      expect(check(permix, 'artifact', hydrated, 'own')).toBe(false);
      expect(check(permix, 'artifact', hydrated, 'delete')).toBe(false);
    }
  });

  it('closure hooks stay live-scoped inside db.withDeleted (revive never resurrects revoked grants or placements)', async () => {
    const parent = await folderOf(organization, 'public');
    const child = await folderOf(organization, 'inherit');
    const placement = (
      await createArtifactPlacement({
        ownerModel: 'Organization',
        organizationId: organization.id,
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
    expect(await db.artifactEffectivePermission.count({ where: { permissionId: perm.id } })).toBe(
      0,
    );

    // Remove placement before tombstoning child, then tombstone and revive child inside withDeleted.
    await db.artifactPlacement.update({
      where: { id: placement.id },
      data: { deletedAt: new Date() },
    });
    await db.artifact.update({ where: { id: child.id }, data: { deletedAt: new Date() } });
    const revived = await db.withDeleted(() =>
      db.artifact.update({ where: { id: child.id }, data: { deletedAt: null } }),
    );

    expect(await db.artifactAncestor.count({ where: { artifactId: child.id } })).toBe(0);
    expect(await db.artifactEffectivePermission.count({ where: { artifactId: child.id } })).toBe(0);
    expect(isArtifactPublic(await hydrateArtifact(revived))).toBe(false);
    expect(artifactEffectiveRole(permixForUser(reader), await hydrateArtifact(revived))).toBeNull();
  });

  it('direct fetchCachedRecordWithTargetEntitlements populates down lists so hydrate succeeds', async () => {
    const folder = await folderOf(organization);
    const cached = await fetchCachedRecordWithTargetEntitlements('artifact', folder.id);
    expect(cached).not.toBeNull();
    const hydrated = await hydrateArtifact(folder);
    expect(Array.isArray(hydrated.ancestors)).toBe(true);
    expect(Array.isArray(hydrated.effectivePermissions)).toBe(true);
  });

  it('tenant access grants read to tenant members (including inherited and member workspaces) but never outsiders or User artifacts', async () => {
    const orgTenantFolder = await folderOf(organization, 'tenant');
    const inheritedChild = await place(await folderOf(organization), orgTenantFolder);
    const orgMemberPermix = permixForUser(reader, [{ id: organization.id, role: 'member' }]);
    const outsiderPermix = permixForUser(reader);

    const hydratedChild = await hydrateArtifact(inheritedChild);
    expect(effectiveArtifactAccess(hydratedChild)).toBe('tenant');
    expect(check(orgMemberPermix, 'artifact', hydratedChild, 'read')).toBe(true);
    expect(check(outsiderPermix, 'artifact', hydratedChild, 'read')).toBe(false);
    expect(artifactEffectiveRole(orgMemberPermix, hydratedChild)).toBeNull();

    // Multi-parent precedence: public > tenant > private
    const pubFolder = await folderOf(organization, 'public');
    await place(inheritedChild, pubFolder);
    expect(effectiveArtifactAccess(await hydrateArtifact(inheritedChild))).toBe('public');

    // Cache invalidates on parent flipping tenant -> private
    const soloParent = await folderOf(organization, 'tenant');
    const soloChild = await place(await folderOf(organization), soloParent);
    expect(check(orgMemberPermix, 'artifact', await hydrateArtifact(soloChild), 'read')).toBe(true);
    await db.artifact.update({ where: { id: soloParent.id }, data: { access: 'private' } });
    expect(check(orgMemberPermix, 'artifact', await hydrateArtifact(soloChild), 'read')).toBe(
      false,
    );

    // OrganizationUser tenant artifact is readable by org peers, not outsiders
    const { context: peerCtx } = await createOrganizationUser({ role: 'member' }, { organization });
    const memberDraft = (
      await createArtifact({
        kind: 'file',
        access: 'tenant',
        ownerModel: 'OrganizationUser',
        organizationId: organization.id,
        userId: peerCtx.user.id,
      })
    ).entity;
    expect(check(orgMemberPermix, 'artifact', await hydrateArtifact(memberDraft), 'read')).toBe(
      true,
    );
    expect(check(outsiderPermix, 'artifact', await hydrateArtifact(memberDraft), 'read')).toBe(
      false,
    );

    // Space tenant artifact is readable by space members, not non-space org members
    const spaceDoc = (
      await createArtifact({
        kind: 'file',
        access: 'tenant',
        ownerModel: 'Space',
        organizationId: organization.id,
        spaceId: space.id,
      })
    ).entity;
    const spaceMemberPermix = permixForUser(
      reader,
      [{ id: organization.id, role: 'member' }],
      [{ id: space.id, role: 'member' }],
    );
    expect(check(spaceMemberPermix, 'artifact', await hydrateArtifact(spaceDoc), 'read')).toBe(
      true,
    );
    expect(check(orgMemberPermix, 'artifact', await hydrateArtifact(spaceDoc), 'read')).toBe(false);

    // User artifact with access: 'tenant' has no tenant, so outsider cannot read it and effectiveAccess reports 'private'
    const userDoc = (
      await createArtifact({
        kind: 'file',
        access: 'tenant',
        ownerModel: 'User',
        userId: peerCtx.user.id,
      })
    ).entity;
    const hydratedUserDoc = await hydrateArtifact(userDoc);
    expect(check(outsiderPermix, 'artifact', hydratedUserDoc, 'read')).toBe(false);
    expect(effectiveArtifactAccess(hydratedUserDoc)).toBe('private');

    // public parent -> tenant child -> inherit grandchild: visibility stops at tenant, explicit grants still inherit
    const pubRoot = await folderOf(organization, 'public');
    await createArtifactPermission({
      artifactId: pubRoot.id,
      granteeModel: 'User',
      granteeUserId: reader.id,
      role: 'admin',
    });
    const tenantMid = await place(await folderOf(organization), pubRoot);
    await db.artifact.update({ where: { id: tenantMid.id }, data: { access: 'tenant' } });
    const inheritLeaf = await place(await folderOf(organization), tenantMid);
    const hydratedLeaf = await hydrateArtifact(inheritLeaf);
    expect(effectiveArtifactAccess(hydratedLeaf)).toBe('tenant');
    expect(check(outsiderPermix, 'artifact', hydratedLeaf, 'read')).toBe(true); // via explicit admin grant from pubRoot
    expect(artifactEffectiveRole(outsiderPermix, hydratedLeaf)).toBe('admin');
    const stranger = (await createUser()).entity;
    expect(check(permixForUser(stranger), 'artifact', hydratedLeaf, 'read')).toBe(false);
    expect(check(orgMemberPermix, 'artifact', hydratedLeaf, 'read')).toBe(true);
  });
});
