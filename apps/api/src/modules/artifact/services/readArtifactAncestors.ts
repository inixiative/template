/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:authz
 */
import type { Artifact } from '@template/db/generated/client/client';
import { isOwnerRootKind } from '@template/shared/artifact';
import type { ArtifactActor } from '#/modules/artifact/lib/artifactActor';
import { parentsWithRootAsTop } from '#/modules/artifact/lib/rootAsTop';
import {
  type ArtifactNode,
  loadArtifactGraph,
} from '#/modules/artifact/services/loadArtifactGraph';
import { readableArtifacts } from '#/modules/artifact/services/readableArtifacts';

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
  const live = [...graph.values()].filter((node) => node.deletedAt === null);
  const readable = new Set(
    (
      await readableArtifacts(
        actor,
        live.filter((node) => !isOwnerRootKind(node.kind)),
      )
    ).map((node) => node.id),
  );

  const reached = new Set<string>();
  const edges: ArtifactAncestry['edges'] = [];
  const visit = (node: ArtifactNode) => {
    const parents = node.containerArtifactIds.flatMap((id) => {
      const parent = graph.get(id);
      return parent && parent.deletedAt === null ? [parent] : [];
    });
    for (const parent of parentsWithRootAsTop(node, parents)) {
      if (!isOwnerRootKind(parent.kind) && !readable.has(parent.id)) continue;
      edges.push({ artifactId: node.id, containerArtifactId: parent.id });
      if (reached.has(parent.id)) continue;
      reached.add(parent.id);
      visit(parent);
    }
  };
  const start = graph.get(artifactId);
  if (start) visit(start);

  return { artifacts: [...reached].map((id) => asArtifact(graph.get(id)!)), edges };
};
