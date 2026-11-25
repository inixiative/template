/**
 * @atlas
 * @kind registry
 * @partOf feature:files
 * @uses none
 */
export const ARTIFACT_MAX_DEPTH = 50;
export const ARTIFACT_MAX_CHILDREN = 500;

export const containerChildren = {
  folder: ['file', 'folder'],
  // ==========================================================================
  // TEMPLATE ABOVE — Add app-specific container kinds below
  // ==========================================================================
} as const;

export type ArtifactKind = 'file' | 'folder';

export const containerArtifactKinds: ArtifactKind[] = Object.keys(
  containerChildren,
) as ArtifactKind[];

export const plainArtifactKinds: ArtifactKind[] = ['folder'];

export const isContainerKind = (kind: string): boolean => kind in containerChildren;

export const canContain = (containerKind: string, childKind: string): boolean =>
  (containerChildren as Record<string, readonly string[]>)[containerKind]?.includes(childKind) ??
  false;
