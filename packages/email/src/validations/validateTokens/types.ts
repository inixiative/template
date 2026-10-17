/**
 * @atlas
 * @kind type
 * @partOf feature:email
 * @uses none
 */
import type { EmailLens } from '@template/email/rules/emailLens';

export type ValidateTokensOptions = {
  lens?: EmailLens;
  isSubject?: boolean;
};

export type TokenPathKind =
  | { kind: 'ok'; optionalDepth: number; scalarList: boolean }
  | { kind: 'missing'; index: number }
  | { kind: 'pastScalar'; index: number }
  | { kind: 'listWithoutEach'; index: number }
  | { kind: 'object' };
