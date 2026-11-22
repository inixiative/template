/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import { db } from '@template/db/client';
import {
  carriedOwnerKeyPairs,
  keysHeldOnAxis,
  modelWhoseOwnerKeysAreCarried,
} from '@template/db/registries/carriedOwnerKeys';
import {
  type PolymorphicValue,
  polymorphicAxis,
  polymorphismConfigForModel,
} from '@template/db/registries/falsePolymorphism';
import { polymorphicKeyColumn } from '@template/db/registries/polymorphicAxisPointsAt';
import type { ModelName } from '@template/db/utils/modelNames';

type Row = Record<string, unknown>;

export const carryOwnerKeys = async (model: ModelName, row: Row): Promise<void> => {
  for (const axis of polymorphismConfigForModel(model)?.axes ?? []) {
    const value = row[axis.field] as PolymorphicValue;
    const carriedFrom = modelWhoseOwnerKeysAreCarried(axis, value);
    if (!carriedFrom) continue;
    const idColumn = polymorphicKeyColumn(model, axis.field, value);
    const carriedFromId = idColumn ? row[idColumn] : null;
    // why: a deleted record still owns its row's keys; a caller's own values never stand
    const carriedFromRow = carriedFromId
      ? ((await db.withDeleted(() =>
          db.delegate(carriedFrom).findUnique({ where: { id: carriedFromId } }),
        )) as Row | null)
      : null;
    const held = carriedFromRow
      ? keysHeldOnAxis(
          carriedFrom,
          polymorphicAxis(carriedFrom, 'ownerModel'),
          carriedFromRow.ownerModel,
        )
      : [];
    for (const { column, carriedKey } of carriedOwnerKeyPairs(model, axis, value))
      row[column] = carriedFromRow && held.includes(carriedKey) ? carriedFromRow[carriedKey] : null;
  }
};
