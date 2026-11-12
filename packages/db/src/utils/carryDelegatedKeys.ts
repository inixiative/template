/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 * @uses none
 */
import { db } from '@template/db/client';
import {
  delegatedKeys,
  getPolymorphismConfig,
  type PolymorphicValue,
  polymorphicAxis,
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
    const parentRow = parentId
      ? ((await db.delegate(parent).findUnique({ where: { id: parentId } })) as Row | null)
      : null;
    if (!parentRow) continue;
    const parentAxis = polymorphicAxis(parent, axis.field);
    const carried: readonly string[] =
      parentAxis.fkMap[parentRow[parentAxis.field] as PolymorphicValue] ?? [];
    for (const key of delegatedKeys(axis, value))
      row[key] = carried.includes(key) ? parentRow[key] : null;
  }
};
