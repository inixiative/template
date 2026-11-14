/**
 * @atlas
 * @kind utils
 * @partOf primitive:authz
 * @uses none
 */
import { getLensRoot, type Lens, type LensNarrowing, type Row } from '@inixiative/json-rules';
import {
  fieldOf,
  hasIdField,
  type LensModel,
  relationTargetOf,
  rootModelOf,
} from '@template/permissions/lens/lensModels';
import { isEqual, isPlainObject, uniq } from 'lodash-es';

/** One path's `projectRows` output over the shared source rows, tagged with the path's key. */
export type LensProjection<PathKey extends string = string> = { path: PathKey; rows: Row[] };

export type MergedProjections<PathKey extends string = string> = {
  rows: Row[];
  attribution: PathKey[];
};

const isRow = (value: unknown): value is Row => isPlainObject(value);

const idOf = (at: LensModel, row: Row, label: string): unknown => {
  if (row.id === undefined || row.id === null)
    throw new Error(`${label}: a ${at.modelName} came back without its id`);
  return row.id;
};

const mergeById = (base: Lens, at: LensModel, lists: Row[][], label: string): Row[] => {
  const carrying = lists.filter((list) => list.length > 0);
  if (!hasIdField(base, at)) {
    if (carrying.length > 1)
      throw new Error(`${label}: ${at.modelName} has no id, so its projections can't be merged`);
    return carrying[0] ?? [];
  }
  const byId = new Map<unknown, Row>();
  for (const list of carrying)
    for (const row of list) {
      const id = idOf(at, row, label);
      const held = byId.get(id);
      byId.set(id, held ? mergeRows(base, at, held, row, `${label}[${String(id)}]`) : row);
    }
  return [...byId.values()];
};

const mergeRelation = (
  base: Lens,
  target: LensModel,
  isList: boolean,
  held: unknown,
  value: unknown,
  label: string,
): unknown => {
  if (value === null || value === undefined) return held;
  if (held === null || held === undefined) return value;
  if (isList && Array.isArray(held) && Array.isArray(value))
    return mergeById(base, target, [held as Row[], value as Row[]], label);
  if (!isList && isRow(held) && isRow(value)) {
    if (hasIdField(base, target) && idOf(target, held, label) !== idOf(target, value, label))
      throw new Error(`${label}: projections disagree on which ${target.modelName} it is`);
    return mergeRows(base, target, held, value, label);
  }
  throw new Error(`${label}: projections disagree on the shape of ${target.modelName}`);
};

const mergeRows = (base: Lens, at: LensModel, left: Row, right: Row, label: string): Row => {
  const merged: Row = { ...left };
  for (const [key, value] of Object.entries(right)) {
    if (!Object.hasOwn(merged, key)) {
      merged[key] = value;
      continue;
    }
    const entry = fieldOf(base, at, key);
    const target = entry ? relationTargetOf(entry, at.mapName) : null;
    if (entry && target)
      merged[key] = mergeRelation(
        base,
        target,
        entry.isList === true,
        merged[key],
        value,
        `${label}.${key}`,
      );
    else if (!isEqual(merged[key], value))
      throw new Error(`${label}.${key}: projections of one source disagree on its value`);
  }
  return merged;
};

/**
 * The chimera of several paths' projections: objects with one `id` are one object holding every
 * key any projection kept, to-one relations merged recursively, every to-many list merged by its
 * items' `id` (never by position), and a present relation beating a missing or null one. Scalars
 * and Json kept by two projections must be equal. Rows come in order of first appearance, and
 * `attribution` names every path that admitted at least one object.
 */
export const mergeProjections = <PathKey extends string>(
  lens: Lens | LensNarrowing,
  projections: readonly LensProjection<PathKey>[],
): MergedProjections<PathKey> => {
  const base = getLensRoot(lens);
  const root = rootModelOf(base);
  return {
    rows: mergeById(
      base,
      root,
      projections.map((projection) => projection.rows),
      root.modelName,
    ),
    attribution: uniq(
      projections.filter((projection) => projection.rows.length > 0).map(({ path }) => path),
    ),
  };
};
