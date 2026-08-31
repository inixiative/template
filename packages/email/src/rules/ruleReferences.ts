/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { type Condition, ruleSourceValues } from '@inixiative/json-rules';
import { prismaMap } from '@template/db/generated/prismaMap';
import { collectRules } from '@template/email/render/conditionParser';
import { emailRuleNarrowing } from '@template/email/rules/emailRuleLens';

export type RuleRowReference = { model: string; id: string };

export type RuleRowReferences = {
  references: RuleRowReference[];
  dynamic: boolean;
};

type IdFields = Record<string, { fields: Record<string, { isId?: boolean }> }>;

const isRowIdSource = (model: string, field: string): boolean =>
  (prismaMap.models as unknown as IdFields)[model]?.fields[field]?.isId === true;

export const referenceKey = (reference: RuleRowReference): string => `${reference.model}|${reference.id}`;

const memo = new Map<string, RuleRowReferences>();

export const ruleReferences = (rule: Condition): RuleRowReferences => {
  const memoKey = JSON.stringify(rule);
  const cached = memo.get(memoKey);
  if (cached) return cached;
  const computed = computeRuleReferences(rule);
  if (memo.size >= 1024) memo.clear();
  memo.set(memoKey, computed);
  return computed;
};

const computeRuleReferences = (rule: Condition): RuleRowReferences => {
  const references: RuleRowReference[] = [];
  let dynamic = false;
  for (const source of ruleSourceValues(emailRuleNarrowing, rule)) {
    if (!isRowIdSource(source.model, source.field)) continue;
    if (source.dynamic) dynamic = true;
    for (const value of source.values) {
      if (typeof value === 'string' && value) references.push({ model: source.model, id: value });
    }
  }
  return { references, dynamic };
};

export const contentRuleReferences = (...contents: string[]): RuleRowReferences => {
  const seen = new Set<string>();
  const references: RuleRowReference[] = [];
  let dynamic = false;
  for (const content of contents) {
    for (const rule of collectRules(content)) {
      const found = ruleReferences(rule);
      dynamic ||= found.dynamic;
      for (const reference of found.references) {
        const key = referenceKey(reference);
        if (seen.has(key)) continue;
        seen.add(key);
        references.push(reference);
      }
    }
  }
  return { references, dynamic };
};
