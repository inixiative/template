/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 * @uses none
 */
import { type Condition, Operator } from '@inixiative/json-rules';
import { getPolymorphismConfig } from '@template/db/registries/falsePolymorphism';
import type { ModelName } from '@template/db/utils/modelNames';

export const POLYMORPHIC_BINDS = { User: 'userId', Organization: 'organizationId', Space: 'spaceId' } as const;

export type PolymorphicKind = keyof typeof POLYMORPHIC_BINDS;

export const polymorphicBindings = (ownerModel: PolymorphicKind, ownerId: string): Record<string, string> => ({
  [POLYMORPHIC_BINDS[ownerModel]]: ownerId,
});

const isOwnerKind = (value: string): value is PolymorphicKind => value in POLYMORPHIC_BINDS;

/**
 * "This row's false-polymorphic axis points at the bound row": one arm per key column, each pairing
 * the discriminator with an optional bind named for the kind. The axis may be an owner, a provider,
 * a resource, a sender — the shape is the same. An unbound kind compiles to `key equals null`, which
 * no row of that kind has (the polymorphism rule makes the key required), so the arm matches nothing.
 */
export const polymorphicIs = (model: ModelName, axisField: string): Condition => {
  const axis = getPolymorphismConfig(model)?.axes.find((candidate) => candidate.field === axisField);
  if (!axis) throw new Error(`${model} has no false-polymorphic axis ${axisField}`);
  const entries = Object.entries(axis.fkMap) as [string, string[]][];
  const kindOf = (fk: string): PolymorphicKind | undefined =>
    entries.find(([value, fks]) => isOwnerKind(value) && fks.length === 1 && fks[0] === fk)?.[0] as
      | PolymorphicKind
      | undefined;
  const columns = [...new Set(entries.flatMap(([, fks]) => fks))];
  return {
    any: columns.flatMap((fk) => {
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
    }),
  };
};
