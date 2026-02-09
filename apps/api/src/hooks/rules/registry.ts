import type { Condition } from '@inixiative/json-rules';
import type { ModelName } from '@template/db';
import { polymorphismRules } from '#/hooks/falsePolymorphism/toRules';

export const RulesRegistry: Partial<Record<ModelName, Condition>> = {
  ...polymorphismRules,
  // Add additional rules here:
  // User: { field: 'name', operator: 'notEmpty', value: true, error: 'name required' },
};

const rulesCache = new Map<ModelName, Condition>();

export const clearRulesCache = (model?: ModelName): void => {
  if (model) rulesCache.delete(model);
  else rulesCache.clear();
};

export const setRulesCache = (model: ModelName, rule: Condition): void => {
  rulesCache.set(model, rule);
};

export const getRule = (model: ModelName): Condition => {
  if (rulesCache.has(model)) return rulesCache.get(model)!;
  const rule = RulesRegistry[model] ?? true;
  rulesCache.set(model, rule);
  return rule;
};
