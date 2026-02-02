/**
 * Error thrown when MJML validation fails.
 */

export type MjmlIssue = {
  line: number;
  message: string;
  tagName: string;
};

export class MjmlValidationError extends Error {
  readonly issues: MjmlIssue[];

  constructor(issues: MjmlIssue[]) {
    super(`Invalid MJML: ${issues.length} issue(s) found`);
    this.name = 'MjmlValidationError';
    this.issues = issues;
  }
}
