/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses infrastructure:prisma
 */

import type { DynamicRuleReference, ReferenceScope } from '@template/db';
import { collectRules, type ScopeRoot } from '@template/email/render/conditionParser';
import {
  type EmailLens,
  emailDynamicRuleReferences,
  emailRuleReferences,
  emailSlotLenses,
} from '@template/email/rules/emailLens';
import { type RuleReference, referenceKey } from '@template/shared/rules';

const namedThrough = (
  lens: EmailLens,
  root: ScopeRoot | undefined,
  contents: string[],
): RuleReference[] => {
  const seen = new Set<string>();
  const references: RuleReference[] = [];
  for (const content of contents) {
    for (const rule of collectRules(content, new Map(), lens)) {
      for (const reference of emailRuleReferences(lens, rule, root)) {
        const key = referenceKey(reference);
        if (seen.has(key)) continue;
        seen.add(key);
        references.push(reference);
      }
    }
  }
  return references;
};

export const contentRuleReferences = (lens: EmailLens, ...contents: string[]): RuleReference[] =>
  namedThrough(lens, undefined, contents);

export const contentReferenceScopes = (lens: EmailLens, ...contents: string[]): ReferenceScope[] =>
  emailSlotLenses(lens).map(([root, slot]) => ({
    lens: slot,
    references: namedThrough(lens, root, contents),
  }));

export const contentDynamicRuleReferences = (
  lens: EmailLens,
  ...contents: string[]
): DynamicRuleReference[] =>
  contents.flatMap((content) =>
    collectRules(content, new Map(), lens).flatMap((rule) =>
      emailDynamicRuleReferences(lens, rule),
    ),
  );
