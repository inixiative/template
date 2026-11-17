/**
 * @atlas
 * @kind validator
 * @partOf feature:segment
 * @uses infrastructure:prisma
 */
import type { Condition } from '@inixiative/json-rules';
import {
  dynamicRuleReferences,
  type RuleValidation,
  ruleReferences,
  validateRuleForLens,
} from '@template/db';
import type { ProviderModel } from '@template/db/generated/client/enums';
import { customerRelationshipLens } from '#/modules/customerRelationship/lib/lenses/customerRelationshipLens';
import { resolvedCustomerRelationshipLens } from '#/modules/customerRelationship/lib/resolvedCustomerRelationshipLens';

const PROBE_OWNER_ID = '00000000-0000-7000-8000-000000000000';

export type ConditionsValidation = RuleValidation;

export const validateSegmentConditions = (
  rawConditions: unknown,
  ownerModel: ProviderModel,
  options: { selfId?: string } = {},
): ConditionsValidation => {
  const validation = validateRuleForLens(rawConditions, customerRelationshipLens, {
    compileWith: resolvedCustomerRelationshipLens(ownerModel, PROBE_OWNER_ID),
  });
  if (!validation.valid) return validation;
  const dynamic = dynamicRuleReferences(
    customerRelationshipLens,
    validation.normalized as Condition,
  );
  if (dynamic.length)
    return {
      valid: false,
      errors: dynamic.map(
        (reference) =>
          `${reference.path}: names a ${reference.model} by a value read at evaluation; name it by id`,
      ),
      normalized: validation.normalized,
    };
  const self = ruleReferences(customerRelationshipLens, validation.normalized as Condition).some(
    (reference) => reference.model === 'Segment' && reference.id === options.selfId,
  );
  return self
    ? {
        valid: false,
        errors: ['a segment cannot reference its own membership'],
        normalized: validation.normalized,
      }
    : validation;
};
