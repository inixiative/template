/**
 * @atlas
 * @kind type
 * @partOf feature:email
 * @uses none
 */
import type { Lens, LensNarrowing } from '@inixiative/json-rules';

export type ValidateTokensOptions = {
  lens?: Lens | LensNarrowing;
  isSubject?: boolean;
};

export type TokenPathKind =
  | { kind: 'ok'; optionalDepth: number; scalarList: boolean }
  | { kind: 'missing'; index: number }
  | { kind: 'pastScalar'; index: number }
  | { kind: 'listWithoutEach'; index: number }
  | { kind: 'object' };
