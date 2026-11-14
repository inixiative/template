/**
 * @atlas
 * @kind utils
 * @partOf primitive:authz
 * @uses none
 */
import { type Lens, type LensNarrowing, lensVisit, type Row } from '@inixiative/json-rules';
import { modelHasId } from '@template/permissions/lens/modelHasId';
import { cloneDeep, isEqual, isPlainObject, uniq } from 'lodash-es';

export type LensProjection<PathKey extends string = string> = {
  path: PathKey;
  lens: Lens | LensNarrowing;
  rows: Row[];
};

export type MergedProjections<PathKey extends string = string> = {
  rows: Row[];
  attribution: PathKey[];
};

type Piece = { lens: Lens | LensNarrowing; rows: Row[] };
type Part = { lens: Lens | LensNarrowing; row: Row };

const childPath = (relationPath: string, field: string) =>
  relationPath ? `${relationPath}.${field}` : field;

const visitOf = (lens: Lens | LensNarrowing, relationPath: string, label: string) => {
  const visit = lensVisit(lens, relationPath);
  if (!visit)
    throw new Error(`${label}: a projection carries ${relationPath}, which its lens hides`);
  return visit;
};

const idOf = (row: Row, model: string, label: string): unknown => {
  if (row.id === undefined || row.id === null)
    throw new Error(`${label}: a ${model} came back without its id`);
  return row.id;
};

const mergeList = (
  source: unknown,
  pieces: Piece[],
  relationPath: string,
  label: string,
): Row[] => {
  const carrying = pieces.filter((piece) => piece.rows.length > 0);
  const [first] = carrying;
  if (!first) return [];
  const visit = visitOf(first.lens, relationPath, label);
  if (!modelHasId(first.lens, visit)) {
    if (carrying.length > 1)
      throw new Error(`${label}: ${visit.model} has no id, so its projections can't be merged`);
    return cloneDeep(first.rows);
  }
  if (!Array.isArray(source)) throw new Error(`${label}: the source rows carry no list here`);

  const byId = carrying.map(
    ({ lens, rows }) =>
      new Map(rows.map((row) => [idOf(row, visit.model, label), { lens, row }] as const)),
  );
  const merged: Row[] = [];
  let matched = 0;
  for (const sourceRow of source as Row[]) {
    const id = idOf(sourceRow, visit.model, label);
    const parts = byId.flatMap((rows) => rows.get(id) ?? []);
    matched += parts.length;
    if (parts.length)
      merged.push(mergeObject(sourceRow, parts, relationPath, `${label}[${String(id)}]`));
  }
  if (matched !== byId.reduce((total, rows) => total + rows.size, 0))
    throw new Error(`${label}: a projection carries a ${visit.model} the source rows do not`);
  return merged;
};

const mergeRelation = (
  source: unknown,
  holders: Part[],
  key: string,
  isList: boolean,
  relationPath: string,
  label: string,
): unknown => {
  const shown = holders.filter(({ row }) => row[key] !== null && row[key] !== undefined);
  if (!shown.length) return holders[0]?.row[key] ?? null;
  const child = childPath(relationPath, key);
  if (isList)
    return mergeList(
      (source as Row | undefined)?.[key],
      shown.map(({ lens, row }) => ({ lens, rows: row[key] as Row[] })),
      child,
      label,
    );
  const sourceRow = (source as Row | undefined)?.[key];
  if (!isPlainObject(sourceRow)) throw new Error(`${label}: the source rows carry no ${key}`);
  return mergeObject(
    sourceRow as Row,
    shown.map(({ lens, row }) => ({ lens, row: row[key] as Row })),
    child,
    label,
  );
};

const mergeObject = (source: Row, parts: Part[], relationPath: string, label: string): Row => {
  const shownFields = new Map(
    parts.map(({ lens }) => [lens, visitOf(lens, relationPath, label).fields] as const),
  );
  const merged: Row = {};
  for (const key of uniq(parts.flatMap(({ row }) => Object.keys(row)))) {
    const holders = parts.filter(({ row }) => Object.hasOwn(row, key));
    const [first] = holders;
    if (!first) continue;
    const entry = shownFields.get(first.lens)?.[key];
    if (entry?.kind === 'object' || entry?.kind === 'bridge') {
      merged[key] = mergeRelation(
        source,
        holders,
        key,
        entry.isList === true,
        relationPath,
        `${label}.${key}`,
      );
      continue;
    }
    if (holders.some(({ row }) => !isEqual(row[key], first.row[key])))
      throw new Error(`${label}.${key}: projections of one source disagree on its value`);
    merged[key] = cloneDeep(first.row[key]);
  }
  return merged;
};

export const mergeProjections = <PathKey extends string>(
  sourceRows: readonly Row[],
  projections: readonly LensProjection<PathKey>[],
): MergedProjections<PathKey> => ({
  rows: mergeList(sourceRows, [...projections], '', 'root'),
  attribution: uniq(
    projections.filter((projection) => projection.rows.length > 0).map(({ path }) => path),
  ),
});
