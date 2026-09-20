/**
 * @atlas
 * @kind error
 * @partOf primitive:shared
 * @uses none
 */
import type { RuleIssue, RuleReference } from '@template/shared/rules/withRule';

export class RuleDegradedError extends Error {
  readonly subject: RuleReference;
  readonly issues: RuleIssue[];

  constructor(subject: RuleReference, issues: RuleIssue[]) {
    super(`${subject.model} ${subject.id} rule is degraded: ${issues.map((issue) => issue.detail).join('; ')}`);
    this.name = 'RuleDegradedError';
    this.subject = subject;
    this.issues = issues;
  }
}

export class RuleEvaluationError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = 'RuleEvaluationError';
    this.cause = cause;
  }
}
