import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db } from '@template/db';
import type { User } from '@template/db/generated/client/client';
import { cleanupTouchedTables, createArtifact, createUser } from '@template/db/test';
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
});
