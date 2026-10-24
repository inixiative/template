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

const setTypedId = (axis: ReturnType<typeof materializedAxes>[number], row: Row): unknown => {
  const [foreignKey] =
    (axis.fkMap as Partial<Record<string, readonly string[]>>)[String(row[axis.field])] ?? [];
  return foreignKey ? row[foreignKey] : undefined;
};

/** Each materialized column that already holds an id other than the one its set typed FK points at. */
export const materializedIdConflicts = (model: ModelName, row: Row): string[] =>
  materializedAxes(model).flatMap((axis) => {
    const id = setTypedId(axis, row);
    const written = row[axis.materialized];
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
