/**
 * @atlas
 * @kind validator
 * @partOf feature:files
 * @uses primitive:authz
 */
import type { ArtifactActor } from '#/modules/artifact/lib/artifactActor';
import { ARTIFACT_EDGE_AUTHORITY } from '#/modules/artifact/lib/artifactEdgeAuthority';
import { assertArtifactAction } from '#/modules/artifact/lib/assertArtifactAction';
import { checkArtifactAccess } from '#/modules/artifact/services/checkArtifactAccess';

export const assertEdgeAuthority = async (
  actor: ArtifactActor,
  artifactId: string,
  containerArtifactId: string,
): Promise<void> => {
  const [member, container] = await Promise.all([
    checkArtifactAccess(actor, [artifactId], ARTIFACT_EDGE_AUTHORITY.member),
    checkArtifactAccess(actor, [containerArtifactId], ARTIFACT_EDGE_AUTHORITY.container),
  ]);
  assertArtifactAction(member.get(artifactId), ARTIFACT_EDGE_AUTHORITY.member);
  assertArtifactAction(container.get(containerArtifactId), ARTIFACT_EDGE_AUTHORITY.container);
};
