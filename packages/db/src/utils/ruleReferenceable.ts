/**
 * @atlas
 * @kind config
 * @partOf infrastructure:prisma
 * @uses none
 */
import { polymorphismConfigForModel } from '@template/db/registries/falsePolymorphism';
import { toModelName } from '@template/db/utils/modelNames';

const targetAxis = polymorphismConfigForModel('RuleReference')?.axes.find(
  (axis) => axis.field === 'targetModel',
);

export const RULE_REFERENCEABLE_MODELS = Object.keys(targetAxis?.fkMap ?? {}).map((model) =>
  toModelName(model),
);
