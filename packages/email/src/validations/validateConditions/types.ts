/**
 * @atlas
 * @kind validator
 * @partOf feature:email
 * @uses primitive:shared
 */
import type { EmailLens } from '@template/email/rules/emailLens';

export type ValidateConditionsOptions = {
  isSubject?: boolean;
  lens?: EmailLens;
};

export type ConditionNode = Record<string, unknown>;
