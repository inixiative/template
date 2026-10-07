/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 * @uses none
 */
import {
  type Condition,
  check,
  type Lens,
  type LensNarrowing,
  type PathProjection,
  type ProjectedVisit,
  projectLens,
} from '@inixiative/json-rules';

type Pruned<T> = T extends readonly (infer E)[]
  ? Array<Pruned<E>>
  : T extends object
    ? { [K in keyof T]?: Pruned<T[K]> } | null
    : T;

const whereColumns = (condition: Condition, out: Set<string>): void => {
  if (condition == null || typeof condition === 'boolean') return;
  const node = condition as Record<string, unknown>;
  for (const key of ['all', 'any']) {
    if (Array.isArray(node[key]))
      for (const child of node[key] as Condition[]) whereColumns(child, out);
  }
  for (const key of ['if', 'then', 'else'])
    if (node[key] !== undefined) whereColumns(node[key] as Condition, out);
  if (typeof node.field === 'string' && node.field) out.add(node.field.split('.')[0]!);
};

const readColumns = (visit: ProjectedVisit): string[] => {
  const columns = new Set(Object.keys(visit.fields));
  for (const clause of visit.whereClauses) whereColumns(clause, columns);
  return [...columns];
};

/** A related row the visit's `where` admits — the lens's data narrowing, applied to a row already in hand. */
const admitted = (visit: ProjectedVisit, row: Record<string, unknown>): boolean =>
  visit.whereClauses.every((clause) => check(clause, row) === true);

const pruneRow = (
  byPath: PathProjection,
  row: Record<string, unknown>,
  path: string,
): Record<string, unknown> => {
  const visit = byPath[path];
  if (!visit) return row;

  const out: Record<string, unknown> = {};
  for (const name of readColumns(visit)) {
    if (!(name in row)) continue;
    const value = row[name];
    const childPath = `${path}.${name}`;
    const child = byPath[childPath];
    if (value != null && child) {
      out[name] = Array.isArray(value)
        ? (value as Record<string, unknown>[])
            .filter((v) => admitted(child, v))
            .map((v) => pruneRow(byPath, v, childPath))
        : admitted(child, value as Record<string, unknown>)
          ? pruneRow(byPath, value as Record<string, unknown>, childPath)
          : null;
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
  const byPath = projectLens(lens);
  const [rootKey] = Object.keys(byPath);
  const root = rootKey ? byPath[rootKey] : undefined;
  if (!rootKey || !root) return data as unknown as Pruned<D>;

  if (Array.isArray(data)) {
    return (data as Record<string, unknown>[])
      .filter((row) => admitted(root, row))
      .map((row) => pruneRow(byPath, row, rootKey)) as unknown as Pruned<D>;
  }
  const row = data as Record<string, unknown>;
  return (admitted(root, row) ? pruneRow(byPath, row, rootKey) : null) as unknown as Pruned<D>;
};
