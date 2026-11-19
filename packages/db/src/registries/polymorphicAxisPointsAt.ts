/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import { type Condition, Operator } from '@inixiative/json-rules';
import { type PolymorphicAxis, polymorphicAxis } from '@template/db/registries/falsePolymorphism';
import type { ModelName } from '@template/db/utils/modelNames';
import { polymorphicArmColumns } from '@template/db/utils/polymorphicArmKeys';
import type { ModelRow } from '@template/shared/utils/modelRow';

export const BIND_NAME_BY_OWNER_MODEL = {
  User: 'userId',
  Organization: 'organizationId',
  Space: 'spaceId',
} as const;

export type BindableOwnerModel = keyof typeof BIND_NAME_BY_OWNER_MODEL;

/** Every key column a false-polymorphic axis uses for a value; empty when the value carries no key (platform, admin). */
export const polymorphicKeyColumns = (
  model: ModelName,
  axisField: string,
  value: string,
): string[] => [
  ...((polymorphicAxis(model, axisField).fkMap as Record<string, readonly string[] | undefined>)[
    value
  ] ?? []),
];

/** Whether `columns` are exactly the key columns an axis uses for a value, in any order. */
export const isArmColumns = (
  model: ModelName,
  axisField: string,
  value: string,
  columns: readonly string[],
): boolean => {
  const keys = polymorphicKeyColumns(model, axisField, value);
  return keys.length === columns.length && keys.every((key) => columns.includes(key));
};

/**
 * The column holding the id of the `value` row an axis points at, or null when the value carries no
 * key (platform, admin). A composite arm answers through its relation (`Inquiry.targetSpace` on
 * `targetOrganizationId` + `targetSpaceId` → `targetSpaceId`); a member arm has no single id column.
 */
export const polymorphicKeyColumn = (
  model: ModelName,
  axisField: string,
  value: string,
): string | null => {
  const columns = polymorphicKeyColumns(model, axisField, value);
  if (columns.length <= 1) return columns[0] ?? null;
  const idColumn = polymorphicArmColumns(model, axisField, value).id;
  if (!idColumn)
    throw new Error(
      `${model}.${axisField} value ${value} keys on ${columns.join('+')} and no single id; ask for polymorphicKeyColumns, or give the axis a dualPolymorphismId`,
    );
  return idColumn;
};

export const polymorphicKeyColumnOrThrow = (
  model: ModelName,
  axisField: string,
  value: string,
): string => {
  const column = polymorphicKeyColumn(model, axisField, value);
  if (!column)
    throw new Error(
      `${model}.${axisField} has no ${value} arm — add its key column to the schema and to PolymorphismRegistry`,
    );
  return column;
};

/** The column naming the row an axis points at: its dual polymorphism id when it has one, else the arm's id column. */
export const axisTargetIdColumn = (
  model: ModelName,
  axis: PolymorphicAxis,
  value: string,
): string | null => axis.dualPolymorphismId ?? polymorphicKeyColumn(model, axis.field, value);

/**
 * The row a false-polymorphic axis points at, its kind and id, or null when it points at nobody.
 * A dual axis names it by its dual polymorphism id, and by the typed FK until that id is written.
 */
export const rowPolymorphicAxisPointsAt = (
  row: Record<string, unknown>,
  model: ModelName,
  axisField: string,
): ModelRow | null => {
  const kind = row[axisField];
  if (typeof kind !== 'string') return null;
  const { dualPolymorphismId } = polymorphicAxis(model, axisField);
  const dualId = dualPolymorphismId ? row[dualPolymorphismId] : null;
  const keyColumn = dualId == null ? polymorphicKeyColumn(model, axisField, kind) : null;
  const id = dualId ?? (keyColumn ? row[keyColumn] : null);
  return typeof id === 'string' ? { model: kind, id } : null;
};

export const polymorphicBindings = (
  ownerModel: BindableOwnerModel,
  ownerId: string,
): Record<string, string> => ({
  [BIND_NAME_BY_OWNER_MODEL[ownerModel]]: ownerId,
});

export const isBindableOwnerModel = (value: string): value is BindableOwnerModel =>
  value in BIND_NAME_BY_OWNER_MODEL;

/**
 * "This row's false-polymorphic axis points at the bound row": one arm per key column, each pairing
 * the discriminator with an optional bind named for the kind. The axis may be an owner, a provider,
 * a resource, a sender — the shape is the same. An unbound kind compiles to `key equals null`, which
 * no row of that kind has (the polymorphism rule makes the key required), so the arm matches nothing.
 */
export const conditionPolymorphicAxisPointsAtBoundRow = (
  model: ModelName,
  axisField: string,
): Condition => {
  const entries = Object.entries(polymorphicAxis(model, axisField).fkMap) as [
    string,
    readonly string[],
  ][];
  const idColumnOf = (value: string, fks: readonly string[]): string | undefined =>
    fks.length === 1 ? fks[0] : polymorphicArmColumns(model, axisField, value).id;
  const kindOf = (fk: string): BindableOwnerModel | undefined =>
    entries.find(
      ([value, fks]) =>
        isBindableOwnerModel(value) && fks.length > 0 && idColumnOf(value, fks) === fk,
    )?.[0] as BindableOwnerModel | undefined;
  const columns = [...new Set(entries.flatMap(([, fks]) => fks))];
  for (const [value, fks] of entries) {
    if (fks.length && !fks.every((fk) => kindOf(fk))) {
      throw new Error(
        `${model}.${axisField} value ${value} keys on ${fks.join('+')}, which no single kind binds`,
      );
    }
  }
  return {
    any: columns.flatMap((fk) => {
      const kind = kindOf(fk);
      if (!kind) return [];
      const values = entries.filter(([, fks]) => fks.includes(fk)).map(([value]) => value);
      return [
        {
          all: [
            { field: axisField, operator: Operator.in, value: values },
            {
              field: fk,
              operator: Operator.equals,
              bind: BIND_NAME_BY_OWNER_MODEL[kind],
              bindOptional: true,
            },
          ],
        },
      ];
    }),
  };
};
