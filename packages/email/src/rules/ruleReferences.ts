/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses infrastructure:prisma
 */

import type { DynamicRuleReference } from '@template/db';
import { collectRules } from '@template/email/render/conditionParser';
import {
  type EmailLens,
  emailDynamicRuleReferences,
  emailRuleReferences,
} from '@template/email/rules/emailLens';
import { type RuleReference, referenceKey } from '@template/shared/rules';

/** The rows the rules in these contents name, folded across every block and branch, deduped. */
export const contentRuleReferences = (lens: EmailLens, ...contents: string[]): RuleReference[] => {
  const seen = new Set<string>();
  const references: RuleReference[] = [];
  for (const content of contents) {
    for (const rule of collectRules(content, new Map(), lens)) {
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

export const contentDynamicRuleReferences = (
  lens: EmailLens,
  ...contents: string[]
): DynamicRuleReference[] =>
  contents.flatMap((content) =>
    collectRules(content, new Map(), lens).flatMap((rule) =>
      emailDynamicRuleReferences(lens, rule),
    ),
  );
