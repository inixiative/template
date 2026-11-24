/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */

import { ownerAxisField } from '@template/db/registries/carriedOwnerKeys';
import {
  type PolymorphicAxis,
  polymorphismConfigForModel,
} from '@template/db/registries/falsePolymorphism';
import type { ModelName } from '@template/db/utils/modelNames';
import { polymorphicArmRelation } from '@template/db/utils/polymorphicArmKeys';

/** Every polymorphic axis of a model but its owner: an inquiry's two sides (`sourceModel`, `targetModel`), a tag attachment's `resourceModel`. */
export const axesOtherThanOwnerOf = (model: ModelName): readonly PolymorphicAxis[] =>
  (polymorphismConfigForModel(model)?.axes ?? []).filter(({ field }) => field !== ownerAxisField);

/** The relation that reaches an axis's row when the axis is of this kind (`targetOrganization`), or undefined when it cannot be. */
export const relationToKindOnAxis = (
  model: ModelName,
  axis: PolymorphicAxis,
  kind: string,
): string | undefined =>
  kind in axis.fkMap ? polymorphicArmRelation(model, axis.field, kind).field : undefined;
