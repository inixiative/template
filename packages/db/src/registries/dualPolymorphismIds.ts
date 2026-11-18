/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import { getPolymorphismConfig } from '@template/db/registries/falsePolymorphism';
import type { ModelName } from '@template/db/utils/modelNames';

type Row = Record<string, unknown>;

const dualPolymorphicAxes = (model: ModelName) =>
  (getPolymorphismConfig(model)?.axes ?? []).flatMap((axis) =>
    axis.dualPolymorphismId ? [{ ...axis, dualPolymorphismId: axis.dualPolymorphismId }] : [],
  );

const armKeys = (
  axis: ReturnType<typeof dualPolymorphicAxes>[number],
  row: Row,
): readonly string[] =>
  (axis.fkMap as Partial<Record<string, readonly string[]>>)[String(row[axis.field])] ?? [];

// why: a composite arm (a member's owner chain) holds no single id, so its dual polymorphism id is the writer's to give.
const setTypedId = (axis: ReturnType<typeof dualPolymorphicAxes>[number], row: Row): unknown => {
  const keys = armKeys(axis, row);
  return keys.length === 1 && keys[0] ? row[keys[0]] : undefined;
};

/** Each dual polymorphism id written without its typed FK, or holding an id other than the one it points at. */
export const dualPolymorphismIdConflicts = (model: ModelName, row: Row): string[] =>
  dualPolymorphicAxes(model).flatMap((axis) => {
    const written = row[axis.dualPolymorphismId];
    const keys = armKeys(axis, row);
    if (keys.length > 1)
      return written != null && keys.some((key) => row[key] == null)
        ? [
            `${model}.${axis.dualPolymorphismId} names a ${String(row[axis.field])}; pass ${keys.join(', ')}`,
          ]
        : [];
    const id = setTypedId(axis, row);
    if (written != null && id == null)
      return [`${model}.${axis.dualPolymorphismId} is set from its typed FK; pass the FK`];
    return id != null && written != null && written !== id
      ? [
          `${model}.${axis.dualPolymorphismId} must equal the ${String(row[axis.field])} id ${String(id)}`,
        ]
      : [];
  });

/** The row with each dual polymorphism id set from its axis's set typed FK. */
export const withDualPolymorphismIds = <T extends Row>(model: ModelName, row: T): T => {
  const filled: Row = { ...row };
  for (const axis of dualPolymorphicAxes(model)) {
    const id = setTypedId(axis, row);
    if (id != null) filled[axis.dualPolymorphismId] = id;
  }
  return filled as T;
};

/** The dual polymorphism id columns of a model; written on create, immutable after. */
export const dualPolymorphismIdColumns = (model: ModelName): string[] =>
  dualPolymorphicAxes(model).map((axis) => axis.dualPolymorphismId);
