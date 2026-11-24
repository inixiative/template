/**
 * @atlas
 * @kind registry
 * @partOf feature:files
 * @uses none
 */
export const ARTIFACT_MAX_DEPTH = 50;

export type ArtifactTypeName = 'container' | 'object';

export type ArtifactKindDef = {
  type: ArtifactTypeName;
  contains: readonly string[];
  defaultAccess: 'public' | 'private';
  contentModel?: 'File';
  lazyCopy?: true;
};

export const ArtifactKinds = {
  file: {
    type: 'object',
    contains: [],
    defaultAccess: 'private',
    contentModel: 'File',
    lazyCopy: true,
  },
  folder: {
    type: 'container',
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

export const plainArtifactKinds = (Object.keys(kindDefs) as ArtifactKind[]).filter(
  (kind) => !kindDefs[kind]!.contentModel,
);

export const canContain = (containerKind: string, objectOrContainerKind: string): boolean =>
  artifactKindDef(containerKind)?.contains.includes(objectOrContainerKind) ?? false;
