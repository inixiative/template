/**
 * @atlas
 * @kind constructor
 * @partOf feature:email
 * @uses none
 */
import type { TokenIssue } from '@template/email/errors/TokenValidationError';

export type DependentTemplateIssue = { slug: string; issues: TokenIssue[] };

export class DependentTemplateError extends Error {
  constructor(
    readonly componentSlug: string,
    readonly dependents: DependentTemplateIssue[],
  ) {
    super(
      `Component "${componentSlug}" would break ${dependents.length} template(s) that embed it:\n${dependents
        .map((dependent) => `  ${dependent.slug}: ${dependent.issues.map((issue) => issue.message).join('; ')}`)
        .join('\n')}`,
    );
    this.name = 'DependentTemplateError';
  }
}
