/**
 * @atlas
 * @kind registry
 * @partOf primitive:shared, feature:files
 * @uses none
 */
export const artifactSystemKeyNamespace = {
  organizationUser: 'organizationUser',
} as const;

export type ArtifactSystemKeyNamespace =
  (typeof artifactSystemKeyNamespace)[keyof typeof artifactSystemKeyNamespace];

export const artifactSystemKey = (namespace: ArtifactSystemKeyNamespace, id: string): string =>
  `${namespace}:${id}`;

export const parseArtifactSystemKey = (
  key: string,
): { namespace: ArtifactSystemKeyNamespace; id: string } | null => {
  const separator = key.indexOf(':');
  if (separator <= 0) return null;
  const namespace = key.slice(0, separator);
  if (!(namespace in artifactSystemKeyNamespace)) return null;
  return { namespace: namespace as ArtifactSystemKeyNamespace, id: key.slice(separator + 1) };
};
