/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */
import { getPolymorphismConfig, type ModelName, resolveFalsePolymorphismRef } from '@template/db';

export type RuleReferenceSurface = { columns: readonly string[] };

export const RULE_REFERENCE_SURFACES: Partial<Record<ModelName, RuleReferenceSurface>> = {
  EmailTemplate: { columns: ['subject', 'mjml'] },
  EmailComponent: { columns: ['mjml'] },
};

type Axis = 'ownerModel' | 'referencedModel';

const axisModels = (axis: Axis): ModelName[] => {
  const config = getPolymorphismConfig('RuleReference');
  const fkMap = config?.axes.find((candidate) => candidate.field === axis)?.fkMap ?? {};
  return Object.keys(fkMap) as ModelName[];
};

const axisKey = (axis: Axis, value: string): string => {
  const key = resolveFalsePolymorphismRef({ model: 'RuleReference', axis, value: value as ModelName });
  if (!key) {
    throw new Error(
      `RuleReference has no ${axis} FK for ${value} — add the column to ruleReference.prisma and PolymorphismRegistry`,
    );
  }
  return key;
};

export const REFERENCED_MODELS: ModelName[] = axisModels('referencedModel');

export const ownerKey = (model: string): string => axisKey('ownerModel', model);
export const referencedKey = (model: string): string => axisKey('referencedModel', model);
