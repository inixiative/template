/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:authz
 */
import type { Artifact } from '@template/db/generated/client/client';
import type { ArtifactActor } from '#/modules/artifact/lib/artifactActor';
import { loadArtifactGraph } from '#/modules/artifact/services/loadArtifactGraph';
import { readableArtifacts } from '#/modules/artifact/services/readableArtifacts';

export type ArtifactAncestry = {
  artifacts: Artifact[];
  edges: { artifactId: string; containerArtifactId: string }[];
};

export const readArtifactAncestors = async (
  actor: ArtifactActor,
  artifactId: string,
): Promise<ArtifactAncestry> => {
  const graph = await loadArtifactGraph([artifactId]);
  const ancestors = [...graph.values()].filter(
    (node) => node.id !== artifactId && node.deletedAt === null,
  );
  const visible = new Set((await readableArtifacts(actor, ancestors)).map((node) => node.id));
  const edges = [...graph.values()].flatMap((node) =>
    node.containerArtifactIds
      .filter((containerArtifactId) => visible.has(containerArtifactId))
      .filter(() => node.id === artifactId || visible.has(node.id))
      .map((containerArtifactId) => ({ artifactId: node.id, containerArtifactId })),
  );
  const artifacts = ancestors
    .filter((node) => visible.has(node.id))
    .map(
      ({ permissions: _permissions, containerArtifactIds: _containerArtifactIds, ...artifact }) =>
        artifact,
    );
  return { artifacts, edges };
};
