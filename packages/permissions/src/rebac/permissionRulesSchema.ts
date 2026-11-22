/**
 * @atlas
 * @kind schema
 * @partOf primitive:authz
 * @uses none
 */
import { validateActionRule } from '@inixiative/permissions';
import {
  type AccessorName,
  type BindableOwnerModel,
  type ModelName,
  relationsToTenantOnSides,
} from '@template/db';
import { schemaMap } from '@template/db/schemaMap';
import { rebacSchema } from '@template/permissions/rebac/schema';
import { ruleAsksStandardActionThroughRelation } from '@template/permissions/rebac/tenantPermissionRules';
import { actionsTenantMayExtend } from '@template/permissions/rebac/tenantPermissionRulesLens';
import { z } from 'zod';

const actionRuleBase: z.ZodType = z.lazy(() =>
  z.union([
    z.string(),
    z.boolean(),
    z.null(),
    z.object({ rel: z.string(), action: z.string() }).strict(),
    z
      .object({ rel: z.string(), arrayOperator: z.literal('any'), condition: actionRuleBase })
      .strict(),
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
    .partialRecord(z.enum(allowed as [string, ...string[]]), actionRuleSchema)
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

/**
 * A tenant's `tenantPermissionRules`: rules for the resources and actions its lens shows
 * (`tenantPermissionRulesLens`), each resource's validated as a row's `permissionRules` are.
 */
export const tenantPermissionRulesSchema = (tenantModel: BindableOwnerModel) =>
  z
    .record(z.string(), z.record(z.string(), z.unknown()))
    .superRefine((byResource, ctx) => {
      for (const [resource, rules] of Object.entries(byResource)) {
        const hidden = Object.keys(rules).filter(
          (action) => !actionsTenantMayExtend(tenantModel, resource).includes(action),
        );
        for (const action of hidden)
          ctx.addIssue({
            code: 'custom',
            path: [resource, action],
            message: `not something a ${tenantModel} may extend`,
          });
        if (hidden.length) continue;
        const ownSides = relationsToTenantOnSides(
          schemaMap.resources[resource] as ModelName,
          tenantModel,
        );
        const offItsSide = ownSides.length
          ? Object.keys(rules).filter(
              (action) =>
                !ownSides.some((relation) =>
                  ruleAsksStandardActionThroughRelation(rules[action], relation),
                ),
            )
          : [];
        for (const action of offItsSide)
          ctx.addIssue({
            code: 'custom',
            path: [resource, action],
            message: `a ${tenantModel}'s rule here asks read, operate, manage or own through its own side: ${ownSides.map((relation) => `{ rel: '${relation}', action }`).join(' or ')}`,
          });
        if (offItsSide.length) continue;
        const model = resource.slice('db:'.length) as AccessorName;
        const parsed = buildPermissionRulesSchema(model).safeParse(rules);
        if (!parsed.success)
          for (const issue of parsed.error.issues)
            ctx.addIssue({
              code: 'custom',
              path: [resource, ...issue.path],
              message: issue.message,
            });
      }
    })
    .nullable();
