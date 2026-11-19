/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import { polymorphicKeyColumn } from '@template/db/registries/polymorphicAxisPointsAt';
import type { ModelName } from '@template/db/utils/modelNames';

export type PolymorphicTarget = { kind: string; id: string };

export const wherePolymorphicSideIsOneOf = (
  model: ModelName,
  sideField: string,
  targets: PolymorphicTarget[],
): { OR: Record<string, unknown>[] } => {
  const idsByKind = new Map<string, Set<string>>();
  for (const { kind, id } of targets)
    idsByKind.set(kind, (idsByKind.get(kind) ?? new Set()).add(id));
  return {
    OR: [...idsByKind].map(([kind, ids]) => {
      const column = polymorphicKeyColumn(model, sideField, kind);
      if (!column) throw new Error(`${model}.${sideField} has no ${kind} arm`);
      return { [sideField]: kind, [column]: { in: [...ids] } };
    }),
  };
};
