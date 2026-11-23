import { beforeEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
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
  createUser,
} from '@template/db/test';
import { permissionsOfUser } from '@template/permissions';
import { createPermissions, installPermissions } from '@template/permissions/client';
import { check, rebacSchema } from '@template/permissions/rebac';
import { ARTIFACT_MAX_DEPTH } from '#/hooks/artifactClosure/syncArtifactClosure';
import {
  artifactEffectiveRole,
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
  await createArtifactPlacement({ artifactId: member.id, containerArtifactId: container.id });
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
      expect(check(selfPermix, rebacSchema, 'artifact', hydrated, 'own')).toBe(true);
      expect(check(orgOwnerPermix, rebacSchema, 'artifact', hydrated, 'read')).toBe(true);
      expect(check(orgOwnerPermix, rebacSchema, 'artifact', hydrated, 'delete')).toBe(true);
      expect(check(orgOwnerPermix, rebacSchema, 'artifact', hydrated, 'manage')).toBe(false);
      expect(check(orgAdminPermix, rebacSchema, 'artifact', hydrated, 'read')).toBe(false);
    }
  });

  it('tenantPermissionRules on Organization can widen db:artifact read to org members', async () => {
    const folder = await folderOf(organization);
    const memberPermix = permixForUser(reader, [{ id: organization.id, role: 'member' }]);
    expect(
      check(memberPermix, rebacSchema, 'artifact', await hydrateArtifact(folder), 'read'),
    ).toBe(false);

    await db.organization.update({
      where: { id: organization.id },
      data: {
        tenantPermissionRules: {
          'db:artifact': { read: { rel: 'organization', action: 'read' } },
        },
      },
    });
    expect(
      check(memberPermix, rebacSchema, 'artifact', await hydrateArtifact(folder), 'read'),
    ).toBe(true);
  });
});
