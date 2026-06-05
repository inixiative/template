import { type FieldMapEntry, type LensNarrowing, projectByPath } from '@inixiative/json-rules';

type Visit = { fields: Record<string, FieldMapEntry> };

// Json/Bytes can't be ordered in SQL; every other scalar (incl. Boolean) and
// enums can. Broader than json-rules' conservative ORDERABLE_KINDS, which also
// drops Boolean/enum.
const NON_ORDERABLE_TYPES = new Set(['Json', 'Bytes']);

const isOrderableLeaf = (entry: FieldMapEntry): boolean =>
  (entry.kind === 'scalar' || entry.kind === 'enum') && !NON_ORDERABLE_TYPES.has(entry.type);

// True if reaching `dottedPath` from the root crosses a to-many (isList) edge.
// Prisma's orderBy can traverse a to-one relation (`{ account: { name: 'asc' } }`)
// but not a to-many, so to-many-reachable leaves are not orderable.
const crossesToMany = (dottedPath: string, rootKey: string, byPath: Map<string, Visit>): boolean => {
  if (dottedPath === rootKey) return false;
  let parentKey = rootKey;
  for (const segment of dottedPath.slice(rootKey.length + 1).split('.')) {
    if (byPath.get(parentKey)?.fields?.[segment]?.isList) return true;
    parentKey = `${parentKey}.${segment}`;
  }
  return false;
};

// Sortable field paths for a lens — the orderBy allowlist, sibling to
// `searchablePaths`. Includes scalar + enum leaves (everything but Json/Bytes)
// reachable through to-one relations. Leaves behind a to-many relation are
// excluded — Prisma's orderBy can't sort by a to-many's field. Unlike
// `searchablePaths`, no redaction is applied: the orderable surface mirrors the
// Zealot reference and advertises every sortable column.
export const orderablePaths = (filterLens: LensNarrowing): string[] => {
  const byPath = projectByPath(filterLens) as Map<string, Visit>;
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
