/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 */
import { type FieldMapEntry, type LensNarrowing, projectByPath } from '@inixiative/json-rules';
import { redactLens } from '@template/db/lens/redactLens';

type Visit = { fields: Record<string, FieldMapEntry> };

const NON_ORDERABLE_TYPES = new Set(['Json', 'Bytes']);

const isOrderableLeaf = (entry: FieldMapEntry): boolean =>
  (entry.kind === 'scalar' || entry.kind === 'enum') && !NON_ORDERABLE_TYPES.has(entry.type);

const crossesToMany = (dottedPath: string, rootKey: string, byPath: Map<string, Visit>): boolean => {
  if (dottedPath === rootKey) return false;
  let parentKey = rootKey;
  for (const segment of dottedPath.slice(rootKey.length + 1).split('.')) {
    if (byPath.get(parentKey)?.fields?.[segment]?.isList) return true;
    parentKey = `${parentKey}.${segment}`;
  }
  return false;
};

export const orderablePaths = (filterLens: LensNarrowing): string[] => {
  const byPath = projectByPath(redactLens(filterLens)) as Map<string, Visit>;
  const rootKey = byPath.keys().next().value;
  if (!rootKey) return [];

  const paths: string[] = [];
  for (const [dottedPath, visit] of byPath) {
    if (crossesToMany(dottedPath, rootKey, byPath)) continue;
    const prefix = dottedPath === rootKey ? '' : dottedPath.slice(rootKey.length + 1);
    for (const [fieldName, entry] of Object.entries(visit.fields)) {
      if (isOrderableLeaf(entry)) paths.push(prefix ? `${prefix}.${fieldName}` : fieldName);
    }
  }
  return paths;
};
