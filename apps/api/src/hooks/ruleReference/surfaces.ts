/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses feature:email
 */
import { type ModelName, resolveFalsePolymorphismRef } from '@template/db';
import { REFERENCEABLE_MODELS } from '@template/email/rules';

export type RuleReferenceSurface = { columns: readonly string[] };

export const RULE_REFERENCE_SURFACES: Partial<Record<ModelName, RuleReferenceSurface>> = {
  EmailTemplate: { columns: ['subject', 'mjml'] },
  EmailComponent: { columns: ['mjml'] },
};

type Axis = 'ownerModel' | 'referencedModel';

const axisKey = (axis: Axis, value: string): string => {
  const key = resolveFalsePolymorphismRef({ model: 'RuleReference', axis, value: value as ModelName });
  if (!key) {
    throw new Error(
      `RuleReference has no ${axis} FK for ${value} — add the column to ruleReference.prisma and PolymorphismRegistry`,
    );
  }
  return key;
};

// why: what a rule may name is the lens's fact, not the FK map's. Deriving it from the columns
// why: that happen to exist lets storage grant and revoke vocabulary silently; this way a lens the
// why: schema has not caught up with fails loudly in axisKey instead.
export const REFERENCED_MODELS: ModelName[] = REFERENCEABLE_MODELS;

export const ownerKey = (model: string): string => axisKey('ownerModel', model);
export const referencedKey = (model: string): string => axisKey('referencedModel', model);
