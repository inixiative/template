/**
 * @atlas
 * @kind registry
 * @uses infrastructure:prisma
 */
import type { Condition } from '@inixiative/json-rules';
import type { ModelName } from '@template/db';
import { polymorphismRules } from '#/hooks/falsePolymorphism/toRules';
import { delegatePermissionRules } from '#/hooks/rules/delegatePermissionRules';
import { memberSelfGrantRules } from '#/hooks/rules/memberSelfGrantRules';

const both = (model: ModelName, rule: Condition): Condition =>
  polymorphismRules[model] ? { all: [polymorphismRules[model], rule] } : rule;

export const RulesRegistry: Partial<Record<ModelName, Condition>> = {
  ...polymorphismRules,
  Integration: both('Integration', delegatePermissionRules.Integration),
  Token: both('Token', delegatePermissionRules.Token),
  OrganizationUser: both('OrganizationUser', {
    all: [delegatePermissionRules.Member, memberSelfGrantRules.OrganizationUser],
  }),
  SpaceUser: both('SpaceUser', {
    all: [delegatePermissionRules.Member, memberSelfGrantRules.SpaceUser],
  }),
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
