/**
 * @atlas
 * @kind validator
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { type Condition, checkRuleAgainstLens } from '@inixiative/json-rules';
import { collectRules } from '@template/email/render/conditionParser';
import { emailRuleNarrowing } from '@template/email/rules/emailRuleLens';

export const ruleVocabularyIssues = (rule: Condition): string[] =>
  checkRuleAgainstLens(rule, emailRuleNarrowing).violations.map(
    (violation) => `${violation.path}: ${violation.reason}`,
  );

export const contentVocabularyIssues = (...contents: string[]): string[] => {
  const issues: string[] = [];
  for (const content of contents) {
    for (const rule of collectRules(content)) issues.push(...ruleVocabularyIssues(rule));
  }
  return issues;
};
