/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { RuleReferenceError, type RuleReferenceOwner, syncRuleReferenceEdges } from '@template/db';
import { contentRuleReferences, type RuleLens } from '@template/email/rules/ruleReferences';
import { contentVocabularyIssues } from '@template/email/rules/validateRuleVocabulary';

export { RuleReferenceError, type RuleReferenceOwner };

/**
 * Recompute one owner's edges from the rule-bearing content it was just saved with. Called by the
 * save path inside its transaction; there is no hook, so a writer that does not call this has no
 * edges and its rules cannot be judged.
 */
export const syncRuleReferences = async (
  owner: RuleReferenceOwner,
  contents: string[],
  lens: RuleLens,
): Promise<void> => {
  const issues = contentVocabularyIssues(lens, ...contents);
  if (issues.length)
    throw new RuleReferenceError(`${owner.model} ${owner.id}: rule outside the lens vocabulary — ${issues[0]}`);

  await syncRuleReferenceEdges(owner, contentRuleReferences(lens, ...contents));
};
