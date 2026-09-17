/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { type RuleReferenceOwner, syncRuleReferenceEdges } from '@template/db';
import { defaultEmailRuleLens } from '@template/email/rules/emailProjection';
import { contentRuleReferences } from '@template/email/rules/ruleReferences';
import type { RuleLens } from '@template/shared/rules';

export const syncRuleReferences = (owner: RuleReferenceOwner, contents: string[], lens: RuleLens | undefined) =>
  syncRuleReferenceEdges(owner, contentRuleReferences(lens ?? defaultEmailRuleLens, ...contents));
