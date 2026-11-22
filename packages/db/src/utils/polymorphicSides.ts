/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import {
  type PolymorphicAxis,
  polymorphismConfigForModel,
} from '@template/db/registries/falsePolymorphism';
import type { ModelName } from '@template/db/utils/modelNames';
import { polymorphicArmRelation } from '@template/db/utils/polymorphicArmKeys';

/** A model's named sides: every polymorphic axis but its owner (an inquiry's `sourceModel` and `targetModel`). */
export const namedSideAxesOf = (model: ModelName): readonly PolymorphicAxis[] =>
  (polymorphismConfigForModel(model)?.axes ?? []).filter(({ field }) => field !== 'ownerModel');

/** The relation that reaches a side's row when the side is of this kind (`targetOrganization`), or undefined when it cannot be. */
export const relationToKindOnSide = (
  model: ModelName,
  axis: PolymorphicAxis,
  kind: string,
): string | undefined =>
  kind in axis.fkMap ? polymorphicArmRelation(model, axis.field, kind).field : undefined;
