/**
 * @atlas
 * @kind constructor
 * @partOf feature:email
 * @uses none
 */
export type ConditionIssue = { path: string; message: string };

export class ConditionValidationError extends Error {
  constructor(readonly issues: ConditionIssue[]) {
    super(`Invalid conditional rule(s):\n${issues.map((x) => `  ${x.path}: ${x.message}`).join('\n')}`);
    this.name = 'ConditionValidationError';
  }
}
