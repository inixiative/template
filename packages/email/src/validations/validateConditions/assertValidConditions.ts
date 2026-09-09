/**
 * @atlas
 * @kind validator
 * @partOf feature:email
 * @uses primitive:shared
 */
import { ConditionValidationError } from '@template/email/errors/ConditionValidationError';
import type { ValidateConditionsOptions } from '@template/email/validations/validateConditions/types';
import { validateConditions } from '@template/email/validations/validateConditions/validateConditions';

export const assertValidConditions = (content: string, options: ValidateConditionsOptions = {}): void => {
  const issues = validateConditions(content, options);
  if (issues.length > 0) throw new ConditionValidationError(issues);
};
