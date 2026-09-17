/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 * @uses primitive:shared
 */
import { type Condition, ruleSourceValues } from '@inixiative/json-rules';
import { prismaMap } from '@template/db/generated/prismaMap';
import type { RuleLens, RuleReference } from '@template/shared/rules';

type IdFields = Record<string, { fields: Record<string, { isId?: boolean }> }>;

const isRowIdSource = (model: string, field: string): boolean =>
  (prismaMap.models as unknown as IdFields)[model]?.fields[field]?.isId === true;

const memo = new WeakMap<RuleLens, Map<string, RuleReference[]>>();

const computeRuleReferences = (lens: RuleLens, rule: Condition): RuleReference[] => {
  const references: RuleReference[] = [];
  for (const source of ruleSourceValues(lens, rule)) {
    if (!isRowIdSource(source.model, source.field)) continue;
    for (const value of source.values) {
      if (typeof value === 'string' && value) references.push({ model: source.model, id: value });
    }
  }
  return references;
};

/** The rows a rule names by id, read through the lens: a source on a model's id field is a row reference. */
export const ruleReferences = (lens: RuleLens, rule: Condition): RuleReference[] => {
  const byRule = memo.get(lens) ?? new Map<string, RuleReference[]>();
  memo.set(lens, byRule);
  const memoKey = JSON.stringify(rule);
  const cached = byRule.get(memoKey);
  if (cached) return cached;
  const computed = computeRuleReferences(lens, rule);
  if (byRule.size >= 1024) byRule.clear();
  byRule.set(memoKey, computed);
  return computed;
};
