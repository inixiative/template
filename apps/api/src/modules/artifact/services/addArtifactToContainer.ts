/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, mutex
 */
import { db } from '@template/db';
import type { ArtifactContainer } from '@template/db/generated/client/client';
import { isContainerKind } from '@template/shared/artifact';
import { makeError } from '#/lib/errors';
import { withOwnerLock } from '#/lib/locks/withOwnerLock';
import type { ArtifactActor } from '#/modules/artifact/lib/artifactActor';
import { ARTIFACT_EDGE_AUTHORITY } from '#/modules/artifact/lib/artifactEdgeAuthority';
import { assertArtifactAction } from '#/modules/artifact/lib/assertArtifactAction';
import { assertContainable } from '#/modules/artifact/lib/assertContainable';
import { assertNoContainerCycle } from '#/modules/artifact/services/assertNoContainerCycle';
import { checkArtifactAccess } from '#/modules/artifact/services/checkArtifactAccess';

export const CONTAINER_GRAPH_OWNER = { ownerModel: 'platform', ownerId: 'artifact' } as const;

export type AddArtifactToContainerInput = {
  artifactId: string;
  containerArtifactId: string;
  inherit?: boolean;
};

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

export const writeArtifactContainer = async ({
  artifactId,
  containerArtifactId,
  inherit,
}: AddArtifactToContainerInput): Promise<ArtifactContainer> => {
  const [member, container] = await Promise.all([
    db.artifact.findUnique({ where: { id: artifactId } }),
    db.artifact.findUnique({ where: { id: containerArtifactId } }),
  ]);
  if (!member || !container) throw makeError({ status: 404, message: 'Artifact not found' });
  assertContainable(container, member);
  if (isContainerKind(member.kind)) await assertNoContainerCycle(containerArtifactId, artifactId);

  const firstContainer = (await db.artifactContainer.count({ where: { artifactId } })) === 0;
  const takeInherit = inherit ?? firstContainer;

  return db.txn(async () => {
    const edge = await db.artifactContainer.create({ data: { containerArtifactId, artifactId } });
    if (takeInherit && member.access !== 'inherit') {
      await db.artifact.update({ where: { id: artifactId }, data: { access: 'inherit' } });
    }
    return edge;
  });
};

export const placeArtifactInContainer = async (
  input: AddArtifactToContainerInput,
): Promise<ArtifactContainer> => {
  const member = await db.artifact.findUnique({
    where: { id: input.artifactId },
    select: { kind: true },
  });
  if (!member || !isContainerKind(member.kind)) return writeArtifactContainer(input);
  return withOwnerLock(CONTAINER_GRAPH_OWNER, 'containers', () => writeArtifactContainer(input));
};

export const addArtifactToContainer = async (
  actor: ArtifactActor,
  input: AddArtifactToContainerInput,
): Promise<ArtifactContainer> => {
  await assertEdgeAuthority(actor, input.artifactId, input.containerArtifactId);
  return placeArtifactInContainer(input);
};
