/**
 * @atlas
 * @kind registry
 * @partOf feature:files
 * @uses none
 */
export type ArtifactTypeName = 'container' | 'object';

export type ArtifactKindDef = {
  type: ArtifactTypeName;
  contains: readonly string[];
  defaultAccess: 'public' | 'private';
  holder: 'local' | 'integration';
  contentModel?: 'File';
  systemOnly?: true;
  memberScoped?: true;
  lazyCopy?: true;
};

export const ArtifactKinds = {
  file: {
    type: 'object',
    contains: [],
    defaultAccess: 'private',
    holder: 'local',
    contentModel: 'File',
    lazyCopy: true,
  },
  folder: {
    type: 'container',
    contains: ['file', 'folder'],
    defaultAccess: 'private',
    holder: 'local',
  },
  organizationUserFolder: {
    type: 'container',
    contains: ['file', 'folder'],
    defaultAccess: 'private',
    holder: 'local',
    systemOnly: true,
    memberScoped: true,
  },
  // ==========================================================================
  // TEMPLATE ABOVE — Add app-specific kinds below
  // ==========================================================================
} satisfies Record<string, ArtifactKindDef>;

export type ArtifactKind = keyof typeof ArtifactKinds;

const kindDefs: Record<string, ArtifactKindDef> = ArtifactKinds;

export const isArtifactKind = (kind: string): kind is ArtifactKind => kind in kindDefs;

export const artifactKindDef = (kind: string): ArtifactKindDef | null => kindDefs[kind] ?? null;

export const plainArtifactKinds = (Object.keys(kindDefs) as ArtifactKind[]).filter(
  (kind) => !kindDefs[kind]!.contentModel && !kindDefs[kind]!.systemOnly,
);

export const canContain = (containerKind: string, objectOrContainerKind: string): boolean =>
  artifactKindDef(containerKind)?.contains.includes(objectOrContainerKind) ?? false;
