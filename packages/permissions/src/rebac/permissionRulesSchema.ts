/**
 * @atlas
 * @kind schema
 * @partOf primitive:authz
 * @uses none
 */

import { type Condition, listBindings } from '@inixiative/json-rules';
import { actionRuleSchema as libraryActionRuleSchema } from '@inixiative/permissions/actionRuleSchema';
import type { AccessorName } from '@template/db';
import { actorBindNames } from '@template/permissions/actor';
import { rebacSchema } from '@template/permissions/rebac/schema';
import { z } from 'zod';

// why: the library schema's condition arms are z.custom, which OpenAPI cannot render; it validates, OpenAPI shows a named ActionRule
const ruleConditions = (rule: unknown): Condition[] => {
  if (!rule || typeof rule !== 'object') return [];
  if ('rule' in rule) return [rule.rule as Condition];
  if ('any' in rule && Array.isArray(rule.any)) return rule.any.flatMap(ruleConditions);
  if ('all' in rule && Array.isArray(rule.all)) return rule.all.flatMap(ruleConditions);
  return [];
};

const validatedActionRule = z.unknown().superRefine((value, context) => {
  const parsed = libraryActionRuleSchema.safeParse(value);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) context.addIssue({ ...issue });
    return;
  }
  const unknownBinds = ruleConditions(value)
    .flatMap((condition) => listBindings(condition))
    .filter((name) => name.startsWith('actor.') && !actorBindNames.has(name));
  if (unknownBinds.length)
    context.addIssue({
      code: 'custom',
      message: `The actor has no ${unknownBinds.join(', ')}; it carries ${[...actorBindNames].join(', ')}`,
    });
});
const withOpenApiRef = validatedActionRule as z.ZodType & {
  openapi?: (name: string, metadata: { description: string }) => z.ZodType;
};
export const actionRuleSchema: z.ZodType =
  withOpenApiRef.openapi?.('ActionRule', {
    description:
      'A serialized @inixiative/permissions ActionRule: a delegated action, { rel, action }, { self, action }, { rule }, { actor }, { any }, { all }, a boolean or null',
  }) ?? validatedActionRule;

export const buildPermissionRulesSchema = (model: AccessorName, pick?: readonly string[]) => {
  const schemaActions = Object.keys(rebacSchema.permissions[`db:${model}`]?.actions ?? {});
  const allowed = pick ? schemaActions.filter((a) => pick.includes(a)) : schemaActions;
  if (allowed.length === 0) return z.never().nullable().optional();
  return z
    .record(z.enum(allowed as [string, ...string[]]), actionRuleSchema)
    .nullable()
    .optional();
};
