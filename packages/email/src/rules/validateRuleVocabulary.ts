/**
 * @atlas
 * @kind validator
 * @partOf feature:email
 * @uses primitive:shared
 */
import { collectRules } from '@template/email/render/conditionParser';
import { type RuleLens, ruleVocabularyIssues } from '@template/shared/rules';

export const contentVocabularyIssues = (lens: RuleLens, ...contents: string[]): string[] =>
  contents.flatMap((content) => collectRules(content).flatMap((rule) => ruleVocabularyIssues(lens, rule)));
