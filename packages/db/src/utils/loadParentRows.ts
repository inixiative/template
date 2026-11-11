/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 * @uses none
 */
import { db } from '@template/db/client';
import { type ParentRow, parentOf } from '@template/db/registries/parentEdges';
import type { ModelName } from '@template/db/utils/modelNames';
import { groupBy, keyBy } from 'lodash-es';

type Row = Record<string, unknown>;

export type LoadedParent = { model: ModelName; row: Row };

/** Each child row's parent, read with tombstones so a parent dying in the same write is still found; null when it has none. */
export const loadParentRows = async (
  child: ModelName,
  rows: Row[],
): Promise<(LoadedParent | null)[]> => {
  const parents = rows.map((row) => parentOf(child, row));
  const pointed = parents.filter((parent): parent is ParentRow => parent !== null);
  const loaded: Record<string, Row> = {};
  for (const [model, group] of Object.entries(groupBy(pointed, 'model'))) {
    const found = (await db.withDeleted(() =>
      db.delegate(model).findMany({ where: { id: { in: group.map((parent) => parent.id) } } }),
    )) as Row[];
    for (const [id, row] of Object.entries(keyBy(found, 'id'))) loaded[`${model}:${id}`] = row;
  }
  return parents.map((parent) => {
    const row = parent ? loaded[`${parent.model}:${parent.id}`] : undefined;
    return parent && row ? { model: parent.model, row } : null;
  });
};
