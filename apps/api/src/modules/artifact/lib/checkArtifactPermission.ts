/**
 * @atlas
 * @kind utils
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:authz
 */
import { db, type HydratedRecord, hydrate } from '@template/db';
import type { Artifact } from '@template/db/generated/client/client';
import type { Role } from '@template/db/generated/client/enums';
import type { Permix } from '@template/permissions/client';
import { check } from '@template/permissions/rebac';
import { roleHierarchy, roleToStandardAction } from '@template/permissions/roles/shared';
import { makeError } from '#/lib/errors';

export type ArtifactAction = 'own' | 'delete' | 'manage' | 'operate' | 'read';

type HydratedAncestor = { inherits?: boolean; ancestorArtifact?: { access?: string } | null };

export const hydrateArtifact = (artifact: Artifact): Promise<HydratedRecord> =>
  hydrate('artifact', artifact);

export const canActOnArtifact = async (
  permix: Permix,
  artifact: Artifact,
  action: ArtifactAction,
): Promise<boolean> => {
  const hydrated = await hydrateArtifact(artifact);
  return check(permix, 'artifact', hydrated, action);
};

export const assertArtifactPermission = async (
  permix: Permix,
  artifactId: string,
  action: ArtifactAction,
): Promise<Artifact & HydratedRecord> => {
  const artifact = await db.artifact.findUnique({ where: { id: artifactId } });
  if (!artifact) throw makeError({ status: 404, message: 'Artifact not found' });
  const hydrated = (await hydrateArtifact(artifact)) as Artifact & HydratedRecord;
  if (!check(permix, 'artifact', hydrated, action)) {
    throw makeError({ status: 403, message: 'Forbidden' });
  }
  return hydrated;
};

export const artifactEffectiveRole = (permix: Permix, hydrated: HydratedRecord): Role | null => {
  // why: public access is reported separately in `effectiveAccess.public`, not synthesized as a viewer role.
  const withoutPublic = { ...hydrated, access: 'private' };
  for (const role of [...roleHierarchy].reverse()) {
    if (check(permix, 'artifact', withoutPublic, roleToStandardAction(role))) {
      return role;
    }
  }
  return null;
};

export const isArtifactPublic = (hydrated: HydratedRecord): boolean => {
  if (hydrated.access === 'public') return true;
  if (hydrated.access !== 'inherit') return false;
  const ancestors = (hydrated.ancestors ?? []) as HydratedAncestor[];
  return ancestors.some(
    (ancestor) => ancestor.inherits === true && ancestor.ancestorArtifact?.access === 'public',
  );
};
