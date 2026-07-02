/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui
 * @uses none
 */
import {
  type Condition,
  check,
  type Lens,
  type LensNarrowing,
  projectByPath,
  type SourceOption,
  type SourceValues,
} from '@inixiative/json-rules';

type Row = Record<string, unknown>;

// Rows anchored at a projection path: segments after the root model name descend
// relations, flattening to-many arrays (mirrors the joins a SourceQuery would emit).
const rowsAtPath = (rows: readonly Row[], path: string): Row[] => {
  let current: Row[] = [...rows];
  for (const segment of path.split('.').slice(1)) {
    const next: Row[] = [];
    for (const row of current) {
      const value = row?.[segment];
      if (Array.isArray(value)) next.push(...(value as Row[]));
      else if (value != null) next.push(value as Row);
    }
    current = next;
  }
  return current;
};

const compose = (whereClauses: Condition[], sourceClauses: Condition[]): Condition => {
  const all = [...whereClauses, ...sourceClauses];
  if (all.length === 0) return true;
  return all.length === 1 ? all[0] : { all };
};

/**
 * Materialize each sourced field's option set from rows already in memory — the
 * client-side dual of `sourceQueries` (which compiles the same declarations to
 * DISTINCT queries for the DB). Same composition: the visit's own `where`
 * narrowing AND the field's source eligibility, here evaluated via `check()`.
 * Feed the result to `exposedSurface`/`projectByPath` as `{ sourceValues }`.
 */
export const sourceValuesFromRows = (lensOrNarrowing: Lens | LensNarrowing, rows: readonly Row[]): SourceValues[] => {
  const out: SourceValues[] = [];

  for (const [path, visit] of projectByPath(lensOrNarrowing)) {
    const sourceFields = Object.entries(visit.sources);
    if (sourceFields.length === 0) continue;

    const anchors = rowsAtPath(rows, path);
    for (const [field, sourceClauses] of sourceFields) {
      const where = compose(visit.whereClauses, sourceClauses);
      const label = visit.sourceLabels[field];

      const byValue = new Map<string, SourceOption>();
      for (const row of anchors) {
        if (check(where, row) !== true) continue;
        const value = row[field];
        if (value == null || typeof value === 'object') continue;
        const key = String(value);
        if (byValue.has(key)) continue;
        const rowLabel = label === undefined ? undefined : row[label];
        byValue.set(key, rowLabel == null ? { value: key } : { value: key, label: String(rowLabel) });
      }

      const options = [...byValue.values()].sort((a, b) => (a.label ?? a.value).localeCompare(b.label ?? b.value));
      out.push({ path, mapName: visit.mapName, model: visit.modelName, field, options });
    }
  }

  return out;
};
