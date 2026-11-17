/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 * @uses none
 */
import { db } from '@template/db/client';
import { delegatedKeyPairs, ownerKeysHeld } from '@template/db/registries/delegatedColumns';
import {
  getPolymorphismConfig,
  type PolymorphicValue,
} from '@template/db/registries/falsePolymorphism';
import type { ModelName } from '@template/db/utils/modelNames';

type Row = Record<string, unknown>;

export const carryDelegatedKeys = async (model: ModelName, row: Row): Promise<void> => {
  for (const axis of getPolymorphismConfig(model)?.axes ?? []) {
    const value = row[axis.field] as PolymorphicValue;
    const parent = axis.delegates?.[value];
    if (!parent) continue;
    const [parentKey] = axis.fkMap[value] ?? [];
    const parentId = parentKey ? row[parentKey] : null;
    // why: a deleted parent still owns its row's keys; a caller's own values never stand
    const parentRow = parentId
      ? ((await db.withDeleted(() =>
          db.delegate(parent).findUnique({ where: { id: parentId } }),
        )) as Row | null)
      : null;
    const held = parentRow ? ownerKeysHeld(parent, parentRow.ownerModel as PolymorphicValue) : [];
    for (const { column, parentKey: key } of delegatedKeyPairs(model, axis, value))
      row[column] = parentRow && held.includes(key) ? parentRow[key] : null;
  }
};
