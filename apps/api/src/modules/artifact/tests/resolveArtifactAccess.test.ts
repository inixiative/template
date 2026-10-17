import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db } from '@template/db';
import type { Artifact, Organization, Space, User } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createArtifact,
  createArtifactContainer,
  createArtifactPermission,
  createOrganization,
  createSpace,
  createUser,
} from '@template/db/test';
import { registerArtifactAccessHook } from '#/hooks/artifactAccess/hook';
import { principalKey } from '#/modules/artifact/lib/artifactPrincipal';
import { resolveArtifactAccess } from '#/modules/artifact/services/resolveArtifactAccess';

const folderOf = async (organization: Organization, access?: Artifact['access']) =>
  (
    await createArtifact({
      kind: 'folder',
      ownerModel: 'Organization',
      organizationId: organization.id,
      ...(access ? { access } : {}),
    })
  ).entity;

const place = async (member: Artifact, container: Artifact) => {
  await createArtifactContainer({ artifactId: member.id, containerArtifactId: container.id });
  return db.artifact.update({ where: { id: member.id }, data: { access: 'inherit' } });
};

const resolve = async (artifact: Artifact) =>
  (await resolveArtifactAccess([artifact.id])).get(artifact.id)!;

const roleOf = async (artifact: Artifact, key: string) =>
  (await resolve(artifact)).grants.find((grant) => principalKey(grant.principal) === key)?.role;

describe('resolveArtifactAccess', () => {
  let organization: Organization;
  let space: Space;
  let reader: User;

  beforeAll(async () => {
    registerArtifactAccessHook();
    organization = (await createOrganization()).entity;
    space = (await createSpace({}, { organization })).entity;
    reader = (await createUser()).entity;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
    clearHookRegistry();
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
    const file = await folderOf(organization);
    await place(file, internal);
    expect((await resolve(file)).public).toBe(false);

    await place(file, shared);
    const resolution = await resolve(file);
    expect(resolution.public).toBe(true);
    expect(await roleOf(file, `Space:${space.id}`)).toBe('member');
  });

  it('an explicit private artifact takes nothing from its containers', async () => {
    const shared = await folderOf(organization, 'public');
    await createArtifactPermission({
      artifactId: shared.id,
      granteeModel: 'User',
      granteeUserId: reader.id,
      role: 'viewer',
    });
    const secret = await folderOf(organization);
    await place(secret, shared);
    await db.artifact.update({ where: { id: secret.id }, data: { access: 'private' } });

    const resolution = await resolve(secret);
    expect(resolution.public).toBe(false);
    expect(await roleOf(secret, `User:${reader.id}`)).toBeUndefined();
    expect(await roleOf(secret, `OrganizationManager:${organization.id}`)).toBe('owner');
  });

  it('a public artifact adds public read and still inherits its containers grants', async () => {
    const team = await folderOf(organization);
    await createArtifactPermission({
      artifactId: team.id,
      granteeModel: 'User',
      granteeUserId: reader.id,
      role: 'admin',
    });
    const page = await folderOf(organization);
    await place(page, team);
    await db.artifact.update({ where: { id: page.id }, data: { access: 'public' } });

    expect((await resolve(page)).public).toBe(true);
    expect(await roleOf(page, `User:${reader.id}`)).toBe('admin');
  });

  it('grants pass down through inherit levels and stop at a private one', async () => {
    const root = await folderOf(organization);
    await createArtifactPermission({
      artifactId: root.id,
      granteeModel: 'User',
      granteeUserId: reader.id,
      role: 'viewer',
    });
    const middle = await folderOf(organization);
    await place(middle, root);
    const leaf = await folderOf(organization);
    await place(leaf, middle);
    expect(await roleOf(leaf, `User:${reader.id}`)).toBe('viewer');

    await db.artifact.update({ where: { id: middle.id }, data: { access: 'private' } });
    expect(await roleOf(leaf, `User:${reader.id}`)).toBeUndefined();
  });

  it('a file at the bottom of the deepest folder chain still takes its root grant', async () => {
    const root = await folderOf(organization);
    await createArtifactPermission({
      artifactId: root.id,
      granteeModel: 'User',
      granteeUserId: reader.id,
      role: 'viewer',
    });
    let parent = root;
    for (let level = 0; level < 10; level++) {
      const child = await folderOf(organization);
      await place(child, parent);
      parent = child;
    }
    const { entity: file } = await createArtifact({
      kind: 'file',
      ownerModel: 'Organization',
      organizationId: organization.id,
    });
    const leaf = await place(file, parent);
    expect(await roleOf(leaf, `User:${reader.id}`)).toBe('viewer');
  });

  it('an expired grant gives nothing', async () => {
    const folder = await folderOf(organization);
    await createArtifactPermission({
      artifactId: folder.id,
      granteeModel: 'User',
      granteeUserId: reader.id,
      role: 'viewer',
      expiresAt: new Date(Date.now() - 1_000),
    });
    expect(await roleOf(folder, `User:${reader.id}`)).toBeUndefined();
  });

  it('a soft-deleted container still counts until its edge is removed', async () => {
    const shared = await folderOf(organization, 'public');
    const file = await folderOf(organization);
    await place(file, shared);
    await db.artifact.update({ where: { id: shared.id }, data: { deletedAt: new Date() } });
    expect((await resolve(file)).public).toBe(true);
  });

  it("another owner's container passes its ownership down capped at admin", async () => {
    const otherOrganization = (await createOrganization()).entity;
    const channel = await folderOf(otherOrganization);
    const post = await folderOf(organization);
    await createArtifactContainer({ artifactId: post.id, containerArtifactId: channel.id });
    await db.artifact.update({ where: { id: post.id }, data: { access: 'inherit' } });

    expect(await roleOf(post, `OrganizationManager:${otherOrganization.id}`)).toBe('admin');
    expect(await roleOf(post, `OrganizationManager:${organization.id}`)).toBe('owner');
  });
});
