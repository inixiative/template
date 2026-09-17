/**
 * @atlas
 * @kind validator
 * @partOf feature:email
 * @uses primitive:shared
 */
import type { ConditionIssue } from '@template/email/errors/ConditionValidationError';
import { parseBlocks } from '@template/email/render/parseBlocks';
import { collect } from '@template/email/validations/validateConditions/collect';
import { collectStraddleIssues } from '@template/email/validations/validateConditions/collectStraddleIssues';
import type { ValidateConditionsOptions } from '@template/email/validations/validateConditions/types';

export const validateConditions = (content: string, options: ValidateConditionsOptions = {}): ConditionIssue[] => {
  const issues: ConditionIssue[] = [];
  collect(content, '$', issues, new Map(), options, 0);

  const nodes = parseBlocks(content);
  if (!(nodes.length === 1 && nodes[0]?.type === 'text')) collectStraddleIssues(nodes, issues);

  return issues;
};
