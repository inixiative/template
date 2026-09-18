/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { collectRules } from '@template/email/render/conditionParser';
import { type EmailLens, emailRuleReferences } from '@template/email/rules/emailLens';
import { type RuleReference, referenceKey } from '@template/shared/rules';

/** The rows the rules in these contents name, folded across every block and branch, deduped. */
export const contentRuleReferences = (lens: EmailLens, ...contents: string[]): RuleReference[] => {
  const seen = new Set<string>();
  const references: RuleReference[] = [];
  for (const content of contents) {
    for (const rule of collectRules(content)) {
      for (const reference of emailRuleReferences(lens, rule)) {
        const key = referenceKey(reference);
        if (seen.has(key)) continue;
        seen.add(key);
        references.push(reference);
      }
    }
  }
  return references;
};
