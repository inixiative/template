/**
 * @atlas
 * @kind helper
 * @partOf primitive:shared
 * @uses none
 */
export type ReferenceMap = Map<string, Set<string>>;

export const findReferenceCycle = (references: ReferenceMap, start: string): string[] | null => {
  const settled = new Set<string>();
  const walk = (id: string, path: string[]): string[] | null => {
    if (settled.has(id) || path.includes(id)) return null;
    for (const next of references.get(id) ?? []) {
      if (next === start) return [...path, id, start];
      const found = walk(next, [...path, id]);
      if (found) return found;
    }
    settled.add(id);
    return null;
  };
  return walk(start, []);
};
