import { describe, expect, it } from 'bun:test';
import { createPermissions } from '@template/permissions/client';
import { directEntitledIds, STANDARD_ACTIONS_IMPLYING } from '@template/permissions/permix';

describe('directEntitledIds', () => {
  it('sets hasBroadEntitlement false when multiple actions match the same direct anchor ID', async () => {
    const owner = createPermissions();
    await owner.setup({ resource: 'db:ArtifactPlacement', id: 'p-1', actions: { manage: true } });
    const permix = createPermissions();
    await permix.setup(
      [
        {
          resource: 'db:ArtifactPlacement',
          anchor: { resource: 'db:ArtifactPlacement', id: 'p-1' },
          actions: { read: true, manage: true },
        },
      ],
      { owner },
    );
    const result = directEntitledIds(permix, 'db:ArtifactPlacement', ['read', 'manage']);
    expect(result.directIds).toEqual(['p-1']);
    expect(result.hasBroadEntitlement).toBe(false);
  });

  it('sets hasBroadEntitlement true when an entitlement is anchored above the target resource', async () => {
    const owner = createPermissions();
    await owner.setup({ resource: 'db:Organization', id: 'org-1', actions: { own: true } });
    const permix = createPermissions();
    await permix.setup(
      [
        {
          resource: 'db:Artifact',
          anchor: { resource: 'db:Organization', id: 'org-1', path: 'organization' },
          actions: { read: true },
        },
      ],
      { owner },
    );
    const result = directEntitledIds(permix, 'db:Artifact', STANDARD_ACTIONS_IMPLYING.read);
    expect(result.directIds).toEqual([]);
    expect(result.hasBroadEntitlement).toBe(true);
  });
});
