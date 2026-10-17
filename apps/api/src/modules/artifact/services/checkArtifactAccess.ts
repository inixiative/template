/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses primitive:authz
 */
import type { Role } from '@template/db/generated/client/enums';
import type { StandardAction } from '@template/permissions/client';
import type { ArtifactActor } from '#/modules/artifact/lib/artifactActor';
import { cappedRole, roleAllows, strongerRole } from '#/modules/artifact/lib/artifactRoles';
import { actorPrincipalRole } from '#/modules/artifact/services/actorPrincipalRole';
import { resolveArtifactAccess } from '#/modules/artifact/services/resolveArtifactAccess';

export type ArtifactAccessVerdict = {
  artifactId: string;
  role: Role | null;
  public: boolean;
  allowed: boolean;
};

export const checkArtifactAccess = async (
  actor: ArtifactActor,
  artifactIds: string[],
  action: StandardAction,
): Promise<Map<string, ArtifactAccessVerdict>> => {
  const resolutions = await resolveArtifactAccess(artifactIds);
  const roleFor = actorPrincipalRole(actor);
  const verdicts = new Map<string, ArtifactAccessVerdict>();
  for (const resolution of resolutions.values()) {
    let role: Role | null = null;
    for (const grant of resolution.grants) {
      role = strongerRole(role, cappedRole(grant.role, await roleFor(grant.principal)));
    }
    const allowed = roleAllows(role, action) || (action === 'read' && resolution.public);
    verdicts.set(resolution.artifactId, {
      artifactId: resolution.artifactId,
      role,
      public: resolution.public,
      allowed,
    });
  }
  return verdicts;
};
