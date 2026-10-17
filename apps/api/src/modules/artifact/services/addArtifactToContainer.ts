/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, mutex
 */
import { db, polymorphicTarget } from '@template/db';
import type { ArtifactContainer } from '@template/db/generated/client/client';
import { isContainerKind } from '@template/shared/artifact';
import { makeError } from '#/lib/errors';
import { withOwnerLock } from '#/lib/locks/withOwnerLock';
import type { ArtifactActor } from '#/modules/artifact/lib/artifactActor';
import { assertContainable } from '#/modules/artifact/lib/assertContainable';
import { assertEdgeAuthority } from '#/modules/artifact/lib/assertEdgeAuthority';
import { assertNoContainerCycle } from '#/modules/artifact/services/assertNoContainerCycle';

export type AddArtifactToContainerInput = {
  artifactId: string;
  containerArtifactId: string;
  inherit?: boolean;
};

const writeEdge = async ({
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

export const addArtifactToContainer = async (
  actor: ArtifactActor,
  input: AddArtifactToContainerInput,
): Promise<ArtifactContainer> => {
  await assertEdgeAuthority(actor, input.artifactId, input.containerArtifactId);
  const member = await db.artifact.findUnique({ where: { id: input.artifactId } });
  const owner = member && polymorphicTarget(member, 'Artifact', 'ownerModel');
  if (!member || !owner || !isContainerKind(member.kind)) return writeEdge(input);
  return withOwnerLock({ ownerModel: owner.kind, ownerId: owner.id }, 'containers', () =>
    writeEdge(input),
  );
};
