/**
 * @atlas
 * @kind config
 * @partOf infrastructure:prisma
 * @uses none
 */
import { getPolymorphismConfig } from '@template/db/registries/falsePolymorphism';
import { toModelName } from '@template/db/utils/modelNames';

const targetAxis = getPolymorphismConfig('RuleReference')?.axes.find(
  (axis) => axis.field === 'targetModel',
);

export const RULE_REFERENCEABLE_MODELS = Object.keys(targetAxis?.fkMap ?? {}).map((model) =>
  toModelName(model),
);
