import { describe, expect, it } from 'bun:test';
import { createPermissions } from '@template/permissions/client';
import { permixIdsWithAction } from '@template/permissions/permix';

describe('permixIdsWithAction', () => {
  it('collects IDs from both role table entries and direct-anchored entitlements for covering actions', async () => {
    const owner = createPermissions();
    await owner.setup({ resource: 'db:Organization', id: 'org-ent', actions: { manage: true } });
    const permix = createPermissions();
    await permix.setup({ resource: 'db:Organization', id: 'org-role', actions: { own: true } });
    await permix.setup(
      [
        {
          resource: 'db:Organization',
          anchor: { resource: 'db:Organization', id: 'org-ent' },
          actions: { manage: true },
        },
        {
          resource: 'db:Organization',
          anchor: { resource: 'db:Organization', id: 'org-read-only' },
          actions: { read: true },
        },
        {
          resource: 'db:Space',
          anchor: { resource: 'db:Organization', id: 'org-ent', path: 'organization' },
          actions: { read: true },
        },
      ],
      { owner },
    );

    expect(permixIdsWithAction(permix, 'db:Organization', 'manage').sort()).toEqual([
      'org-ent',
      'org-role',
    ]);
    expect(permixIdsWithAction(permix, 'db:Organization', 'read').sort()).toEqual([
      'org-ent',
      'org-read-only',
      'org-role',
    ]);
    expect(permixIdsWithAction(permix, 'db:Space', 'read')).toEqual([]);
  });
});
