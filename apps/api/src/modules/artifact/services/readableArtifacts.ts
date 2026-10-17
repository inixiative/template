/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses primitive:authz
 */
import type { Artifact } from '@template/db/generated/client/client';
import type { ArtifactActor } from '#/modules/artifact/lib/artifactActor';
import { checkArtifactAccess } from '#/modules/artifact/services/checkArtifactAccess';

export const readableArtifacts = async <T extends Pick<Artifact, 'id'>>(
  actor: ArtifactActor,
  artifacts: T[],
): Promise<T[]> => {
  const verdicts = await checkArtifactAccess(
    actor,
    artifacts.map((artifact) => artifact.id),
    'read',
  );
  return artifacts.filter((artifact) => verdicts.get(artifact.id)?.allowed);
};
