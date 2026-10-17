/**
 * @atlas
 * @kind registry
 * @partOf feature:files
 * @uses none
 */
export type ArtifactKindDef = {
  contains: readonly string[];
  defaultAccess: 'public' | 'private';
  holder: 'local' | 'integration';
  crossOwner: 'edge' | 'copy';
  contentModel?: 'File';
  lazyCopy?: true;
};

export const ArtifactKinds = {
  file: {
    contains: [],
    defaultAccess: 'private',
    holder: 'local',
    crossOwner: 'copy',
    contentModel: 'File',
    lazyCopy: true,
  },
  folder: {
    contains: ['file', 'folder'],
    defaultAccess: 'private',
    holder: 'local',
    crossOwner: 'copy',
  },
  // ==========================================================================
  // TEMPLATE ABOVE — Add app-specific kinds below
  // ==========================================================================
} satisfies Record<string, ArtifactKindDef>;

export type ArtifactKind = keyof typeof ArtifactKinds;

const kindDefs: Record<string, ArtifactKindDef> = ArtifactKinds;

export const isArtifactKind = (kind: string): kind is ArtifactKind => kind in kindDefs;

export const artifactKindDef = (kind: string): ArtifactKindDef | null => kindDefs[kind] ?? null;

export const isContainerKind = (kind: string): boolean =>
  (artifactKindDef(kind)?.contains.length ?? 0) > 0;

export const plainArtifactKinds = (Object.keys(kindDefs) as ArtifactKind[]).filter(
  (kind) => !kindDefs[kind]!.contentModel,
);

export const canContain = (containerKind: string, memberKind: string): boolean =>
  artifactKindDef(containerKind)?.contains.includes(memberKind) ?? false;
