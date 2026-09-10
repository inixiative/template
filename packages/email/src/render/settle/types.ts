/**
 * @atlas
 * @kind type
 * @partOf feature:email
 * @uses none
 */
import type { Lens, LensNarrowing } from '@inixiative/json-rules';
import type { BindingChain } from '@template/email/rules/resolveBindingPath';

export type RenderIssueKind = 'rule' | 'token' | 'each';

export type RenderIssue = { kind: RenderIssueKind; path?: string; detail: string };

export type RuleErrorSink = (issue: RenderIssue) => void;

export type Scope = Record<string, unknown>;

export type SettleOptions = {
  substitute: boolean;
  eachDepth?: number;
  liveRefs?: ReadonlySet<string>;
  bindings?: BindingChain;
  lens?: Lens | LensNarrowing;
};
