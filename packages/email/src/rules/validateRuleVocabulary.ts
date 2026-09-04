/**
 * @atlas
 * @kind validator
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { type Condition, checkRuleAgainstLens } from '@inixiative/json-rules';
import { collectRules } from '@template/email/render/conditionParser';
import type { RuleLens } from '@template/email/rules/ruleReferences';

export const ruleVocabularyIssues = (lens: RuleLens, rule: Condition): string[] =>
  checkRuleAgainstLens(rule, lens).violations.map(
    (violation) => `${violation.path}: ${violation.reason}`,
  );

export const contentVocabularyIssues = (lens: RuleLens, ...contents: string[]): string[] => {
  const issues: string[] = [];
  for (const content of contents) {
    for (const rule of collectRules(content)) issues.push(...ruleVocabularyIssues(lens, rule));
  }
  return issues;
};
