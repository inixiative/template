/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { type Condition, ruleSourceValues } from '@inixiative/json-rules';
import { prismaMap } from '@template/db/generated/prismaMap';
import { collectRules } from '@template/email/render/conditionParser';
import { type RuleLens, type RuleReference, referenceKey } from '@template/shared/rules';

export type RuleRowReference = RuleReference;
export { type RuleLens, referenceKey };

type IdFields = Record<string, { fields: Record<string, { isId?: boolean }> }>;

const isRowIdSource = (model: string, field: string): boolean =>
  (prismaMap.models as unknown as IdFields)[model]?.fields[field]?.isId === true;

const memo = new WeakMap<RuleLens, Map<string, RuleRowReference[]>>();

export const ruleReferences = (lens: RuleLens, rule: Condition): RuleRowReference[] => {
  const byRule = memo.get(lens) ?? new Map<string, RuleRowReference[]>();
  memo.set(lens, byRule);
  const memoKey = JSON.stringify(rule);
  const cached = byRule.get(memoKey);
  if (cached) return cached;
  const computed = computeRuleReferences(lens, rule);
  if (byRule.size >= 1024) byRule.clear();
  byRule.set(memoKey, computed);
  return computed;
};

const computeRuleReferences = (lens: RuleLens, rule: Condition): RuleRowReference[] => {
  const references: RuleRowReference[] = [];
  for (const source of ruleSourceValues(lens, rule)) {
    if (!isRowIdSource(source.model, source.field)) continue;
    for (const value of source.values) {
      if (typeof value === 'string' && value) references.push({ model: source.model, id: value });
    }
  }
  return references;
};

export const contentRuleReferences = (lens: RuleLens, ...contents: string[]): RuleRowReference[] => {
  const seen = new Set<string>();
  const references: RuleRowReference[] = [];
  for (const content of contents) {
    for (const rule of collectRules(content)) {
      for (const reference of ruleReferences(lens, rule)) {
        const key = referenceKey(reference);
        if (seen.has(key)) continue;
        seen.add(key);
        references.push(reference);
      }
    }
  }
  return references;
};
