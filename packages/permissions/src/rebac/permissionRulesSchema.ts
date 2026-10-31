/**
 * @atlas
 * @kind schema
 * @partOf primitive:authz
 * @uses none
 */
import { validateActionRule } from '@inixiative/permissions';
import type { AccessorName } from '@template/db';
import { rebacSchema } from '@template/permissions/rebac/schema';
import { z } from 'zod';

const actionRuleBase: z.ZodType = z.lazy(() =>
  z.union([
    z.string(),
    z.boolean(),
    z.null(),
    z.object({ rel: z.string(), action: z.string() }).strict(),
    z.object({ rule: z.unknown() }).strict(),
    z.object({ any: z.array(actionRuleBase) }).strict(),
    z.object({ all: z.array(actionRuleBase) }).strict(),
  ]),
);

// Register a $ref name so zod-to-openapi can break the recursion when api
// boots and serializes its OpenAPI spec. The `.openapi()` method is patched
// onto zod's prototype by @hono/zod-openapi at runtime; we cast to access it
// without forcing this package to depend on @hono/zod-openapi.
const withOpenApiRef = actionRuleBase as z.ZodType & {
  openapi?: (name: string) => z.ZodType;
};
const actionRuleSchema: z.ZodType = withOpenApiRef.openapi?.('ActionRule') ?? actionRuleBase;

export const buildPermissionRulesSchema = (model: AccessorName, pick?: readonly string[]) => {
  const schemaActions = Object.keys(rebacSchema.permissions[`db:${model}`]?.actions ?? {});
  const allowed = pick ? schemaActions.filter((a) => pick.includes(a)) : schemaActions;
  if (allowed.length === 0) return z.never().nullable().optional();
  const resource = `db:${model}`;
  return z
    .record(z.enum(allowed as [string, ...string[]]), actionRuleSchema)
    .superRefine((rowRules, ctx) => {
      for (const [action, rule] of Object.entries(rowRules))
        for (const issue of validateActionRule(rule, {
          schema: rebacSchema,
          resource,
          action,
          rowRules,
        }).errors)
          ctx.addIssue({
            code: 'custom',
            path: [action],
            message: `${issue.path}: ${issue.message}`,
          });
    })
    .nullable()
    .optional();
};
