/**
 * @atlas
 * @kind utils
 * @partOf primitive:authz, feature:files
 * @uses none
 */
import type { HydratedRecord } from '@template/db';
import type { Role } from '@template/db/generated/client/enums';
import type { Permix } from '@template/permissions/client';
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
