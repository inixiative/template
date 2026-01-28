import type { ModelName } from '@template/db';
import type { Condition } from '@inixiative/json-rules';

export const RulesRegistry: Partial<Record<ModelName, Condition>> = {
  // Example - single rule:
  // Token: { field: 'ownerModel', operator: 'in', value: ['User', 'Organization', 'OrganizationUser'], error: 'Invalid ownerModel' },
  //
  // Example - multiple rules:
  // Setting: {
  //   all: [
  //     { field: 'resourceType', operator: 'in', value: ['User', 'Organization'], error: 'Invalid resourceType' },
  //     { field: 'key', operator: 'notEmpty', value: true, error: 'key is required' },
  //   ],
  // },
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
