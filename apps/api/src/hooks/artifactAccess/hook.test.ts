import { beforeEach, describe, expect, it } from 'bun:test';
import type { User } from '@template/db/generated/client/client';
import { createArtifact, createUser } from '@template/db/test';

describe('artifactAccess hook', () => {
  let owner: User;

  beforeEach(async () => {
    owner = (await createUser()).entity;
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

  it('stamps type from the kind catalog and respects explicit access with private default', async () => {
    const defaultFolder = await folder();
    expect(defaultFolder.type).toBe('container');
    expect(defaultFolder.access).toBe('private');
    expect((await folder('inherit')).access).toBe('inherit');
    expect((await folder('public')).access).toBe('public');
  });

  it('refuses a kind the catalog does not know', async () => {
    await expect(
      createArtifact({ kind: 'spaceship', ownerModel: 'User', userId: owner.id }),
    ).rejects.toThrow('Unknown artifact kind');
  });
});
