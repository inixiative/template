import { type FieldMapEntry, type LensNarrowing, projectByPath } from '@inixiative/json-rules';

// Each projectByPath entry maps a dotted lens-anchored path to the per-visit projection.
// `fields` is keyed by field name; entries carry the same shape as a FieldMap field.
type Visit = { fields: Record<string, FieldMapEntry> };

export const searchablePaths = (filterLens: LensNarrowing): string[] => {
  const byPath = projectByPath(filterLens) as Map<string, Visit>;
  const paths: string[] = [];
  // First entry is always the root anchor — strip its prefix from nested paths so
  // callers get `sourceUser.name` rather than `Inquiry.sourceUser.name`.
  const rootKey = byPath.keys().next().value;
  if (!rootKey) return paths;
  for (const [dottedPath, visit] of byPath) {
    const prefix = dottedPath === rootKey ? '' : dottedPath.slice(rootKey.length + 1);
    for (const [fieldName, entry] of Object.entries(visit.fields)) {
      if (entry.kind === 'scalar' || entry.kind === 'enum') {
        paths.push(prefix ? `${prefix}.${fieldName}` : fieldName);
      }
    }
  }
  return paths;
};
