/**
 * @atlas
 * @kind constructor
 * @partOf feature:email
 * @uses none
 */
export type TokenIssue = { path: string; message: string };

export class TokenValidationError extends Error {
  constructor(readonly issues: TokenIssue[]) {
    super(`Invalid token(s):\n${issues.map((issue) => `  ${issue.path}: ${issue.message}`).join('\n')}`);
    this.name = 'TokenValidationError';
  }
}
