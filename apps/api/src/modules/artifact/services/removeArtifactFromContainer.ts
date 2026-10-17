/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, mutex
 */
import { db } from '@template/db';
import type { ArtifactContainer } from '@template/db/generated/client/client';
import { isOwnerRootKind } from '@template/shared/artifact';
import { makeError } from '#/lib/errors';
import { withOwnerLock } from '#/lib/locks/withOwnerLock';
import type { ArtifactActor } from '#/modules/artifact/lib/artifactActor';
import { ARTIFACT_EDGE_AUTHORITY } from '#/modules/artifact/lib/artifactEdgeAuthority';
import { artifactOwner, sameArtifactOwner } from '#/modules/artifact/lib/artifactOwner';
import { assertArtifactAction } from '#/modules/artifact/lib/assertArtifactAction';
import { assertEdgeAuthority } from '#/modules/artifact/lib/assertEdgeAuthority';
import { assertKeepsOwnersOnlyReach } from '#/modules/artifact/services/assertKeepsOwnersOnlyReach';
import { assertOwnersOnlyStaysHome } from '#/modules/artifact/services/assertOwnersOnlyStaysHome';
import { checkArtifactAccess } from '#/modules/artifact/services/checkArtifactAccess';

const assertForeignRemoval = async (actor: ArtifactActor, edge: ArtifactContainer) => {
  const [container, member] = await Promise.all([
    checkArtifactAccess(actor, [edge.containerArtifactId], ARTIFACT_EDGE_AUTHORITY.container),
    checkArtifactAccess(actor, [edge.artifactId], ARTIFACT_EDGE_AUTHORITY.member),
  ]);
  const containerVerdict = container.get(edge.containerArtifactId);
  if (containerVerdict?.allowed) return;
  assertArtifactAction(member.get(edge.artifactId), ARTIFACT_EDGE_AUTHORITY.member);
};

export const removeArtifactFromContainer = async (
  actor: ArtifactActor,
  edge: ArtifactContainer,
): Promise<void> => {
  const [member, container] = await Promise.all([
    db.artifact.findUniqueOrThrow({ where: { id: edge.artifactId } }),
    db.artifact.findUniqueOrThrow({ where: { id: edge.containerArtifactId } }),
  ]);
  if (isOwnerRootKind(container.kind)) {
    throw makeError({
      status: 422,
      message: "An artifact stays in its owner's root while it lives; delete it to remove it",
    });
  }
  if (sameArtifactOwner(member, container)) {
    await assertEdgeAuthority(actor, edge.artifactId, edge.containerArtifactId);
  } else {
    await assertForeignRemoval(actor, edge);
  }

  await withOwnerLock(artifactOwner(member), 'containers', () =>
    db.txn(async () => {
      await assertKeepsOwnersOnlyReach([edge.artifactId], edge.containerArtifactId);
      await db.artifactContainer.update({
        where: { id: edge.id },
        data: { deletedAt: new Date() },
      });
      await assertOwnersOnlyStaysHome([edge.artifactId]);
    }),
  );
};
