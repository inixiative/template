/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 * @uses none
 */
import {
  type FieldMapEntry,
  type LensNarrowing,
  type PathProjection,
  projectLens,
} from '@inixiative/json-rules';
import { redactLens } from '@template/db/lens/redactLens';
import { rootLens } from '@template/db/lens/rootLens';

const NON_ORDERABLE_TYPES = new Set(['Json', 'Bytes']);

const isOrderableLeaf = (entry: FieldMapEntry): boolean =>
  (entry.kind === 'scalar' || entry.kind === 'enum') && !NON_ORDERABLE_TYPES.has(entry.type);

const crossesToMany = (dottedPath: string, rootKey: string, byPath: PathProjection): boolean => {
  if (dottedPath === rootKey) return false;
  let parentKey = rootKey;
  for (const segment of dottedPath.slice(rootKey.length + 1).split('.')) {
    if (byPath[parentKey]?.fields[segment]?.isList) return true;
    parentKey = `${parentKey}.${segment}`;
  }
  return false;
};

export const orderablePaths = (filterLens: LensNarrowing): string[] => {
  const byPath = projectLens(redactLens(filterLens));
  const rootKey = rootLens(filterLens).model;

  const paths: string[] = [];
  for (const [dottedPath, visit] of Object.entries(byPath)) {
    if (crossesToMany(dottedPath, rootKey, byPath)) continue;
    const prefix = dottedPath === rootKey ? '' : dottedPath.slice(rootKey.length + 1);
    for (const [fieldName, entry] of Object.entries(visit.fields)) {
      if (isOrderableLeaf(entry)) paths.push(prefix ? `${prefix}.${fieldName}` : fieldName);
    }
  }
  return paths;
};
