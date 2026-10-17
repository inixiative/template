import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db } from '@template/db';
import type { User } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createArtifact,
  createArtifactContainer,
  createUser,
} from '@template/db/test';
import { registerArtifactAccessHook } from '#/hooks/artifactAccess/hook';

describe('artifactAccess hook', () => {
  let owner: User;

  beforeAll(async () => {
    registerArtifactAccessHook();
    owner = (await createUser()).entity;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
    clearHookRegistry();
  });

  const folder = async (access?: 'inherit' | 'public' | 'private') =>
    (
      await createArtifact({
        kind: 'folder',
        ownerModel: 'User',
        userId: owner.id,
        ...(access ? { access } : {}),
      })
    ).entity;

  const access = async (id: string) =>
    (await db.artifact.findUniqueOrThrow({ where: { id }, select: { access: true } })).access;

  it('stamps the kind default on an artifact created without a container', async () => {
    expect((await folder()).access).toBe('private');
    expect((await folder('inherit')).access).toBe('private');
    expect((await folder('public')).access).toBe('public');
  });

  it('refuses a kind the catalog does not know', async () => {
    await expect(
      createArtifact({ kind: 'spaceship', ownerModel: 'User', userId: owner.id }),
    ).rejects.toThrow('Unknown artifact kind');
  });

  it('resolves inherit to private when the artifact sits in no container', async () => {
    const orphan = await folder('public');
    await db.artifact.update({ where: { id: orphan.id }, data: { access: 'inherit' } });
    expect(await access(orphan.id)).toBe('private');
  });

  it('keeps inherit while a container holds the artifact', async () => {
    const container = await folder();
    const member = await folder();
    await createArtifactContainer({ artifactId: member.id, containerArtifactId: container.id });
    await db.artifact.update({ where: { id: member.id }, data: { access: 'inherit' } });
    expect(await access(member.id)).toBe('inherit');
  });

  it('resolves inherit to private when the last container edge is removed, not before', async () => {
    const first = await folder('public');
    const second = await folder('public');
    const member = await folder();
    const { entity: firstEdge } = await createArtifactContainer({
      artifactId: member.id,
      containerArtifactId: first.id,
    });
    const { entity: secondEdge } = await createArtifactContainer({
      artifactId: member.id,
      containerArtifactId: second.id,
    });
    await db.artifact.update({ where: { id: member.id }, data: { access: 'inherit' } });

    await db.artifactContainer.delete({ where: { id: firstEdge.id } });
    expect(await access(member.id)).toBe('inherit');

    await db.artifactContainer.deleteMany({ where: { id: secondEdge.id } });
    expect(await access(member.id)).toBe('private');
  });

  it('settles orphans set to inherit by a bulk update', async () => {
    const orphan = await folder('public');
    await db.artifact.updateManyAndReturn({
      where: { id: orphan.id },
      data: { access: 'inherit' },
    });
    expect(await access(orphan.id)).toBe('private');
  });
});
