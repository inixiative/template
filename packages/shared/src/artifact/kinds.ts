/**
 * @atlas
 * @kind registry
 * @partOf feature:files
 * @uses none
 */
export const ARTIFACT_MAX_DEPTH = 50;
export const ARTIFACT_MAX_CHILDREN = 500;

export type ArtifactKindDef = {
  contains: readonly string[];
  defaultAccess: 'public' | 'tenant' | 'private';
  contentModel?: 'File';
  lazyCopy?: true;
};

export const ArtifactKinds = {
  file: {
    contains: [],
    defaultAccess: 'private',
    contentModel: 'File',
    lazyCopy: true,
  },
  folder: {
    contains: ['file', 'folder'],
    defaultAccess: 'private',
  },
  // ==========================================================================
  // TEMPLATE ABOVE — Add app-specific kinds below
  // ==========================================================================
} satisfies Record<string, ArtifactKindDef>;

export type ArtifactKind = keyof typeof ArtifactKinds;

const kindDefs: Record<string, ArtifactKindDef> = ArtifactKinds;

export const artifactKindDef = (kind: string): ArtifactKindDef | null => kindDefs[kind] ?? null;

export const isContainerKind = (kind: string): boolean =>
  (artifactKindDef(kind)?.contains.length ?? 0) > 0;

export const containerArtifactKinds = (Object.keys(kindDefs) as ArtifactKind[]).filter(
  isContainerKind,
);

export const plainArtifactKinds = (Object.keys(kindDefs) as ArtifactKind[]).filter(
  (kind) => !kindDefs[kind]!.contentModel,
);

export const canContain = (containerKind: string, childKind: string): boolean =>
  artifactKindDef(containerKind)?.contains.includes(childKind) ?? false;
