/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 * @uses none
 */
import { type Condition, Operator } from '@inixiative/json-rules';
import { getPolymorphismConfig, type SpecialOwner } from '@template/db/registries/falsePolymorphism';
import type { ModelName } from '@template/db/utils/modelNames';

export const POLYMORPHIC_BINDS = { User: 'userId', Organization: 'organizationId', Space: 'spaceId' } as const;

export type PolymorphicFkKind = keyof typeof POLYMORPHIC_BINDS;

export type PolymorphicKind = PolymorphicFkKind | SpecialOwner;

/** The key column a false-polymorphic axis uses for a value, or null when the value carries no key (platform, admin). */
export const polymorphicKeyColumn = (model: ModelName, axisField: string, value: string): string | null => {
  const axis = getPolymorphismConfig(model)?.axes.find((candidate) => candidate.field === axisField);
  if (!axis) throw new Error(`${model} has no false-polymorphic axis ${axisField}`);
  return (axis.fkMap as Record<string, string[] | undefined>)[value]?.[0] ?? null;
};

/** The row a false-polymorphic axis points at — its kind and id — or null when it points at nobody. */
export const polymorphicTarget = (
  row: Record<string, unknown>,
  model: ModelName,
  axisField: string,
): { kind: string; id: string } | null => {
  const kind = row[axisField];
  if (typeof kind !== 'string') return null;
  const column = polymorphicKeyColumn(model, axisField, kind);
  const id = column ? row[column] : null;
  return typeof id === 'string' ? { kind, id } : null;
};

const isFkKind = (value: string): value is PolymorphicFkKind => value in POLYMORPHIC_BINDS;

export const polymorphicBindings = (ownerModel: PolymorphicKind, ownerId: string): Record<string, string> =>
  isFkKind(ownerModel) ? { [POLYMORPHIC_BINDS[ownerModel]]: ownerId } : { [ownerModel]: ownerModel };

/**
 * "This row's false-polymorphic axis points at the bound row": one arm per key column, each pairing
 * the discriminator with an optional bind named for the kind. The axis may be an owner, a provider,
 * a resource, a sender — the shape is the same. An unbound kind compiles to `key equals null`, which
 * no row of that kind has (the polymorphism rule makes the key required), so the arm matches nothing.
 * A value with no key (platform, admin, default) gets one arm keyed on the discriminator itself, bound
 * under the value's own name; unbound it compiles to `axis equals null` and matches nothing likewise.
 */
export const polymorphicIs = (model: ModelName, axisField: string): Condition => {
  const axis = getPolymorphismConfig(model)?.axes.find((candidate) => candidate.field === axisField);
  if (!axis) throw new Error(`${model} has no false-polymorphic axis ${axisField}`);
  const entries = Object.entries(axis.fkMap) as [string, string[]][];
  const kindOf = (fk: string): PolymorphicFkKind | undefined =>
    entries.find(([value, fks]) => isFkKind(value) && fks.length === 1 && fks[0] === fk)?.[0] as
      | PolymorphicFkKind
      | undefined;
  const columns = [...new Set(entries.flatMap(([, fks]) => fks))];
  for (const [value, fks] of entries) {
    if (fks.length && !fks.every((fk) => kindOf(fk))) {
      throw new Error(`${model}.${axisField} value ${value} keys on ${fks.join('+')}, which no single kind binds`);
    }
  }
  const fkArms = columns.flatMap((fk) => {
    const kind = kindOf(fk);
    if (!kind) return [];
    const values = entries.filter(([, fks]) => fks.includes(fk)).map(([value]) => value);
    return [
      {
        all: [
          { field: axisField, operator: Operator.in, value: values },
          { field: fk, operator: Operator.equals, bind: POLYMORPHIC_BINDS[kind], bindOptional: true },
        ],
      },
    ];
  });
  const discriminatorArms = entries
    .filter(([, fks]) => fks.length === 0)
    .map(([value]) => ({
      all: [
        { field: axisField, operator: Operator.equals, value },
        { field: axisField, operator: Operator.equals, bind: value, bindOptional: true },
      ],
    }));
  return { any: [...fkArms, ...discriminatorArms] };
};
