/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { type RuleReferenceOwner, syncRuleReferenceEdges } from '@template/db';
import { defaultEmailLens, type EmailLens } from '@template/email/rules/emailLens';
import { contentRuleReferences } from '@template/email/rules/ruleReferences';

export const syncRuleReferences = (owner: RuleReferenceOwner, contents: string[], lens: EmailLens | undefined) =>
  syncRuleReferenceEdges(owner, contentRuleReferences(lens ?? defaultEmailLens, ...contents));
