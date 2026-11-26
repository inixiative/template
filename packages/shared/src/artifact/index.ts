/**
 * @atlas
 * @kind registry
 * @partOf feature:files
 * @uses none
 */
import type { ArtifactKind } from '@template/db/generated/client/enums';

export type { ArtifactKind };

export const ARTIFACT_MAX_DEPTH = 50;
export const ARTIFACT_MAX_CHILDREN = 500;

const containerChildren: Partial<Record<ArtifactKind, readonly ArtifactKind[]>> = {
  folder: ['file', 'folder'],
  // ==========================================================================
  // TEMPLATE ABOVE — Add app-specific container kinds below
  // ==========================================================================
};

// Kinds created directly via plain create routes (kinds without a content table).
export const plainArtifactKinds = ['folder'] as const;

export const containerArtifactKinds: ArtifactKind[] = [
  'root',
  ...(Object.keys(containerChildren) as ArtifactKind[]),
];

export const isRootKind = (kind: ArtifactKind): boolean => kind === 'root';

export const isContainerKind = (kind: ArtifactKind): boolean =>
  kind === 'root' || kind in containerChildren;

export const canContain = (containerKind: ArtifactKind, childKind: ArtifactKind): boolean => {
  if (childKind === 'root') return false;
  if (containerKind === 'root') return true;
  return containerChildren[containerKind]?.includes(childKind) ?? false;
};
