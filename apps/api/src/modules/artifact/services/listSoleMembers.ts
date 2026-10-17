/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { Artifact } from '@template/db/generated/client/client';
import { isOwnerRootKind } from '@template/shared/artifact';
import { sameArtifactOwner } from '#/modules/artifact/lib/artifactOwner';

export const listSoleMembers = async (container: Artifact): Promise<Artifact[]> => {
  const members = await db.artifact.findMany({
    where: { containers: { some: { containerArtifactId: container.id } } },
    include: { containers: { include: { containerArtifact: true } } },
    orderBy: { name: 'asc' },
  });
  return members
    .filter((member) => sameArtifactOwner(member, container))
    .filter((member) =>
      member.containers.every(
        ({ containerArtifact }) =>
          containerArtifact.id === container.id ||
          isOwnerRootKind(containerArtifact.kind) ||
          !sameArtifactOwner(containerArtifact, member),
      ),
    )
    .map(({ containers: _containers, ...member }) => member);
};
