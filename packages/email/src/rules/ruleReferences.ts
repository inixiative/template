/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { type Condition, type Lens, type LensNarrowing, ruleSourceValues } from '@inixiative/json-rules';
import { prismaMap } from '@template/db/generated/prismaMap';
import { collectRules } from '@template/email/render/conditionParser';

export type RuleRowReference = { model: string; id: string };

export type RuleRowReferences = {
  references: RuleRowReference[];
  dynamic: boolean;
};

type IdFields = Record<string, { fields: Record<string, { isId?: boolean }> }>;

const isRowIdSource = (model: string, field: string): boolean =>
  (prismaMap.models as unknown as IdFields)[model]?.fields[field]?.isId === true;

export const referenceKey = (reference: RuleRowReference): string => `${reference.model}|${reference.id}`;

export type RuleLens = Lens | LensNarrowing;

// why: extraction is a function of the rule AND the lens, so the memo is keyed by both — the same
// why: rule read through a different lens names different rows.
const memo = new WeakMap<RuleLens, Map<string, RuleRowReferences>>();

export const ruleReferences = (lens: RuleLens, rule: Condition): RuleRowReferences => {
  const byRule = memo.get(lens) ?? new Map<string, RuleRowReferences>();
  memo.set(lens, byRule);
  const memoKey = JSON.stringify(rule);
  const cached = byRule.get(memoKey);
  if (cached) return cached;
  const computed = computeRuleReferences(lens, rule);
  if (byRule.size >= 1024) byRule.clear();
  byRule.set(memoKey, computed);
  return computed;
};

const computeRuleReferences = (lens: RuleLens, rule: Condition): RuleRowReferences => {
  const references: RuleRowReference[] = [];
  let dynamic = false;
  for (const source of ruleSourceValues(lens, rule)) {
    if (!isRowIdSource(source.model, source.field)) continue;
    if (source.dynamic) dynamic = true;
    for (const value of source.values) {
      if (typeof value === 'string' && value) references.push({ model: source.model, id: value });
    }
  }
  return { references, dynamic };
};

export const contentRuleReferences = (lens: RuleLens, ...contents: string[]): RuleRowReferences => {
  const seen = new Set<string>();
  const references: RuleRowReference[] = [];
  let dynamic = false;
  for (const content of contents) {
    for (const rule of collectRules(content)) {
      const found = ruleReferences(lens, rule);
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
