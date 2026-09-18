/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 * @uses none
 */
import {
  type Condition,
  type Lens,
  type LensNarrowing,
  type PathProjection,
  projectByPath,
} from '@inixiative/json-rules';

type Pruned<T> = T extends readonly (infer E)[]
  ? Array<Pruned<E>>
  : T extends object
    ? { [K in keyof T]?: Pruned<T[K]> }
    : T;

const whereColumns = (condition: Condition, out: Set<string>): void => {
  if (condition == null || typeof condition === 'boolean') return;
  const node = condition as Record<string, unknown>;
  for (const key of ['all', 'any']) {
    if (Array.isArray(node[key])) for (const child of node[key] as Condition[]) whereColumns(child, out);
  }
  for (const key of ['if', 'then', 'else']) if (node[key] !== undefined) whereColumns(node[key] as Condition, out);
  if (typeof node.field === 'string' && node.field) out.add(node.field.split('.')[0]!);
};

const readColumns = (visit: PathProjection extends Map<string, infer V> ? V : never): string[] => {
  const columns = new Set(Object.keys(visit.fields));
  for (const clause of visit.whereClauses) whereColumns(clause, columns);
  return [...columns];
};

const pruneRow = (byPath: PathProjection, row: Record<string, unknown>, path: string): Record<string, unknown> => {
  const visit = byPath.get(path);
  if (!visit) return row;

  const out: Record<string, unknown> = {};
  for (const name of readColumns(visit)) {
    if (!(name in row)) continue;
    const value = row[name];
    const childPath = `${path}.${name}`;
    if (value != null && byPath.has(childPath)) {
      out[name] = Array.isArray(value)
        ? value.map((v) => pruneRow(byPath, v as Record<string, unknown>, childPath))
        : pruneRow(byPath, value as Record<string, unknown>, childPath);
    } else {
      out[name] = value;
    }
  }
  return out;
};

export const prune = <D extends Record<string, unknown> | readonly Record<string, unknown>[]>(
  data: D,
  lens: Lens | LensNarrowing,
): Pruned<D> => {
  const byPath = projectByPath(lens);
  const [rootKey] = byPath.keys();
  if (!rootKey) return data as unknown as Pruned<D>;

  return (Array.isArray(data)
    ? data.map((row) => pruneRow(byPath, row, rootKey))
    : pruneRow(byPath, data as Record<string, unknown>, rootKey)) as unknown as Pruned<D>;
};
