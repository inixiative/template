/**
 * @atlas
 * @kind utils
 * @partOf primitive:authz, feature:files
 * @uses none
 */
import type { HydratedRecord } from '@template/db';
import type { Role } from '@template/db/generated/client/enums';
import type { Permix } from '@template/permissions/client';
import { permixIdsWithAction } from '@template/permissions/permix';
import { check } from '@template/permissions/rebac';
import { roleHierarchy, roleToStandardAction } from '@template/permissions/roles/shared';

export type ArtifactAction = 'own' | 'delete' | 'manage' | 'operate' | 'read';

export const artifactEffectiveRole = (permix: Permix, hydrated: HydratedRecord): Role | null => {
  // why: public/tenant visibility is reported on artifact.effectiveAccess, not synthesized as a viewer role.
  const withoutVisibility = { ...hydrated, effectiveAccess: 'private' };
  for (const role of [...roleHierarchy].reverse()) {
    if (check(permix, 'artifact', withoutVisibility, roleToStandardAction(role))) {
      return role;
    }
  }
  return null;
};

export type AccessibleArtifactGranteeIds = {
  readableUserIds: string[];
  manageableUserIds: string[];
  readableOrganizationIds: string[];
  ownedOrganizationIds: string[];
  readableSpaceIds: string[];
  operableOrganizationUserIds: string[];
  operableSpaceUserIds: string[];
};

export const accessibleArtifactGranteeIds = (permix: Permix): AccessibleArtifactGranteeIds => ({
  readableUserIds: permixIdsWithAction(permix, 'db:User', 'read'),
  manageableUserIds: permixIdsWithAction(permix, 'db:User', 'manage'),
  readableOrganizationIds: permixIdsWithAction(permix, 'db:Organization', 'read'),
  ownedOrganizationIds: permixIdsWithAction(permix, 'db:Organization', 'own'),
  readableSpaceIds: permixIdsWithAction(permix, 'db:Space', 'read'),
  operableOrganizationUserIds: permixIdsWithAction(permix, 'db:OrganizationUser', 'operate'),
  operableSpaceUserIds: permixIdsWithAction(permix, 'db:SpaceUser', 'operate'),
});

export type AccessibleArtifactOwnerIds = AccessibleArtifactGranteeIds & {
  manageableOrganizationIds: string[];
  manageableSpaceIds: string[];
  ownedSpaceIds: string[];
};

export const accessibleArtifactOwnerIds = (permix: Permix): AccessibleArtifactOwnerIds => ({
  ...accessibleArtifactGranteeIds(permix),
  manageableOrganizationIds: permixIdsWithAction(permix, 'db:Organization', 'manage'),
  manageableSpaceIds: permixIdsWithAction(permix, 'db:Space', 'manage'),
  ownedSpaceIds: permixIdsWithAction(permix, 'db:Space', 'own'),
});
