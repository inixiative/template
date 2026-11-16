/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:authz
 */
import type { Artifact } from '@template/db/generated/client/client';
import type { ArtifactActor } from '#/modules/artifact/lib/artifactActor';
import { listableArtifacts } from '#/modules/artifact/services/listableArtifacts';
import {
  type ArtifactNode,
  loadArtifactGraph,
} from '#/modules/artifact/services/loadArtifactGraph';

export type ArtifactAncestry = {
  artifacts: Artifact[];
  edges: { artifactId: string; containerArtifactId: string }[];
};

const asArtifact = ({
  permissions: _p,
  containerArtifactIds: _c,
  ...artifact
}: ArtifactNode): Artifact => artifact;

export const readArtifactAncestors = async (
  actor: ArtifactActor,
  artifactId: string,
): Promise<ArtifactAncestry> => {
  const graph = await loadArtifactGraph([artifactId]);
  const live = [...graph.values()].filter(
    (node) => node.deletedAt === null && node.id !== artifactId,
  );
  const readable = new Set((await listableArtifacts(actor, live)).map((node) => node.id));

  const reached = new Set<string>();
  const edges: ArtifactAncestry['edges'] = [];
  const visit = (node: ArtifactNode) => {
    for (const containerArtifactId of node.containerArtifactIds) {
      if (!readable.has(containerArtifactId)) continue;
      edges.push({ artifactId: node.id, containerArtifactId });
      if (reached.has(containerArtifactId)) continue;
      reached.add(containerArtifactId);
      visit(graph.get(containerArtifactId)!);
    }
  };
  const start = graph.get(artifactId);
  if (start) visit(start);

  return { artifacts: [...reached].map((id) => asArtifact(graph.get(id)!)), edges };
};
