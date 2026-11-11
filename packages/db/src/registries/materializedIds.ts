/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 * @uses none
 */
import { getPolymorphismConfig } from '@template/db/registries/falsePolymorphism';
import type { ModelName } from '@template/db/utils/modelNames';

type Row = Record<string, unknown>;

const materializedAxes = (model: ModelName) =>
  (getPolymorphismConfig(model)?.axes ?? []).flatMap((axis) =>
    axis.materialized ? [{ ...axis, materialized: axis.materialized }] : [],
  );

const armKeys = (axis: ReturnType<typeof materializedAxes>[number], row: Row): readonly string[] =>
  (axis.fkMap as Partial<Record<string, readonly string[]>>)[String(row[axis.field])] ?? [];

// why: a composite arm (a member's owner chain) holds no single id, so its materialized id is the writer's to give.
const setTypedId = (axis: ReturnType<typeof materializedAxes>[number], row: Row): unknown => {
  const keys = armKeys(axis, row);
  return keys.length === 1 && keys[0] ? row[keys[0]] : undefined;
};

/** Each materialized column written without its typed FK, or holding an id other than the one it points at. */
export const materializedIdConflicts = (model: ModelName, row: Row): string[] =>
  materializedAxes(model).flatMap((axis) => {
    const written = row[axis.materialized];
    const keys = armKeys(axis, row);
    if (keys.length > 1)
      return written != null && keys.some((key) => row[key] == null)
        ? [
            `${model}.${axis.materialized} names a ${String(row[axis.field])}; pass ${keys.join(', ')}`,
          ]
        : [];
    const id = setTypedId(axis, row);
    if (written != null && id == null)
      return [`${model}.${axis.materialized} is set from its typed FK; pass the FK`];
    return id != null && written != null && written !== id
      ? [`${model}.${axis.materialized} must equal the ${String(row[axis.field])} id ${String(id)}`]
      : [];
  });

/** The row with each materialized column set from its axis's set typed FK. */
export const withMaterializedIds = <T extends Row>(model: ModelName, row: T): T => {
  const filled: Row = { ...row };
  for (const axis of materializedAxes(model)) {
    const id = setTypedId(axis, row);
    if (id != null) filled[axis.materialized] = id;
  }
  return filled as T;
};

/** The plain columns an axis materializes; written on create, immutable after. */
export const materializedColumns = (model: ModelName): string[] =>
  materializedAxes(model).map((axis) => axis.materialized);
