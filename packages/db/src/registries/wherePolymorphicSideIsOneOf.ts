/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import { polymorphicAxis } from '@template/db/registries/falsePolymorphism';
import { polymorphicKeyColumnOrThrow } from '@template/db/registries/polymorphicAxisPointsAt';
import type { ModelName } from '@template/db/utils/modelNames';
import type { ModelRow } from '@template/shared/utils/modelRow';

export const wherePolymorphicSideIsOneOf = (
  model: ModelName,
  sideField: string,
  targets: ModelRow[],
): { OR: Record<string, unknown>[] } => {
  const axis = polymorphicAxis(model, sideField);
  const idsByKind = new Map<string, Set<string>>();
  for (const { model: kind, id } of targets)
    idsByKind.set(kind, (idsByKind.get(kind) ?? new Set()).add(id));
  return {
    OR: [...idsByKind].map(([kind, ids]) => {
      const idColumn =
        axis.dualPolymorphismId ?? polymorphicKeyColumnOrThrow(model, sideField, kind);
      return { [sideField]: kind, [idColumn]: { in: [...ids] } };
    }),
  };
};
