/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import {
  type PointedAtRecord,
  polymorphicKeyColumnOrThrow,
} from '@template/db/registries/polymorphicAxisPointsAt';
import type { ModelName } from '@template/db/utils/modelNames';

export const wherePolymorphicSideIsOneOf = (
  model: ModelName,
  sideField: string,
  targets: PointedAtRecord[],
): { OR: Record<string, unknown>[] } => {
  const idsByKind = new Map<string, Set<string>>();
  for (const { kind, id } of targets)
    idsByKind.set(kind, (idsByKind.get(kind) ?? new Set()).add(id));
  return {
    OR: [...idsByKind].map(([kind, ids]) => {
      return {
        [sideField]: kind,
        [polymorphicKeyColumnOrThrow(model, sideField, kind)]: { in: [...ids] },
      };
    }),
  };
};
