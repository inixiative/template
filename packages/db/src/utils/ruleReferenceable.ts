/**
 * @atlas
 * @kind config
 * @partOf infrastructure:prisma
 * @uses none
 */
import { getPolymorphismConfig } from '@template/db/registries/falsePolymorphism';
import type { ModelName } from '@template/db/utils/modelNames';

const referencedAxis = getPolymorphismConfig('RuleReference')?.axes.find((axis) => axis.field === 'referencedModel');

export const RULE_REFERENCEABLE_MODELS = Object.keys(referencedAxis?.fkMap ?? {}) as ModelName[];
