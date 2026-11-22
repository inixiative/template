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
import { castArray } from 'lodash-es';

/** An owner by the models it is keyed on: `{ Organization: id, Space: null, User: null }` is the organization alone. */
export type OwnerKeys = Partial<Record<ModelName, string | null>>;

/** A row the side points at, or an owner whose keys the side carries (itself or a delegate that carries them). */
export type PolymorphicSideMatch = ModelRow | { ownerKeys: OwnerKeys };

const ownerKeysArm = (model: ModelName, sideField: string, ownerKeys: OwnerKeys) =>
  Object.fromEntries(
    Object.entries(ownerKeys).map(([keyModel, id]) => [
      polymorphicKeyColumnOrThrow(model, sideField, keyModel),
      id ?? null,
    ]),
  );

const sideArms = (model: ModelName, sideField: string, matches: PolymorphicSideMatch[]) => {
  const { dualPolymorphismId } = polymorphicAxis(model, sideField);
  const idsByModel = new Map<string, Set<string>>();
  const arms: Record<string, unknown>[] = [];
  for (const match of matches) {
    if ('ownerKeys' in match) arms.push(ownerKeysArm(model, sideField, match.ownerKeys));
    else idsByModel.set(match.model, (idsByModel.get(match.model) ?? new Set()).add(match.id));
  }
  const rowArms = [...idsByModel].map(([rowModel, ids]) => ({
    [sideField]: rowModel,
    [dualPolymorphismId ?? polymorphicKeyColumnOrThrow(model, sideField, rowModel)]: {
      in: [...ids],
    },
  }));
  return [...rowArms, ...arms];
};

export const wherePolymorphicSideIsOneOf = (
  model: ModelName,
  sideFields: string | string[],
  matches: PolymorphicSideMatch[],
): Record<string, unknown> => {
  const arms = castArray(sideFields).flatMap((sideField) => sideArms(model, sideField, matches));
  return arms.length === 1 ? arms[0]! : { OR: arms };
};
