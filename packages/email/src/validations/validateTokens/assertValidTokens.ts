/**
 * @atlas
 * @kind validator
 * @partOf feature:email
 * @uses none
 */
import { TokenValidationError } from '@template/email/errors/TokenValidationError';
import type { ValidateTokensOptions } from '@template/email/validations/validateTokens/types';
import { validateTokens } from '@template/email/validations/validateTokens/validateTokens';

export const assertValidTokens = (content: string, options: ValidateTokensOptions = {}): void => {
  const issues = validateTokens(content, options);
  if (issues.length > 0) throw new TokenValidationError(issues);
};
