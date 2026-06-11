/**
 * @atlas
 * @partOf infrastructure:prisma
 */
import { type FieldMapEntry, type LensNarrowing, projectByPath } from '@inixiative/json-rules';
import { redactLens } from '@template/db/lens/redactLens';

type Visit = { fields: Record<string, FieldMapEntry> };

export const searchablePaths = (filterLens: LensNarrowing): string[] => {
  const byPath = projectByPath(redactLens(filterLens)) as Map<string, Visit>;
  const paths: string[] = [];
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
