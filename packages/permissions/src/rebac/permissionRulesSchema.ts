import type { AccessorName } from '@template/db';
import { rebacSchema } from '@template/permissions/rebac/schema';
import { z } from 'zod';

// Recursive Zod schema for an `ActionRule` envelope. Validates the SHAPE only:
// - delegation strings, { rel, action }, { self }, { any }, { all } structures
// - the inner json-rules Condition under `{ rule: ... }` is passed through as
//   unknown — runtime json-rules `check()` validates it when the rule fires.
const actionRuleBase: z.ZodType = z.lazy(() =>
  z.union([
    z.string(), // delegate to another action on the same model
    z.null(),
    z.object({ rel: z.string(), action: z.string() }).strict(),
    z.object({ self: z.string() }).strict(),
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

/**
 * Build a Zod schema for a `permissionRules: Json?` column on a model.
 * Valid action keys are derived from the model's rebac schema entry — no
 * second source of truth to maintain. Pass `pick` to narrow further.
 *
 * @example
 *   // All actions defined for `contact` in rebacSchema
 *   permissionRules: buildPermissionRulesSchema('contact'),
 *
 *   // Only `read` is row-overridable (sharing); manage/delete owner-only
 *   permissionRules: buildPermissionRulesSchema('contact', ['read']),
 */
export const buildPermissionRulesSchema = (model: AccessorName, pick?: readonly string[]) => {
  const schemaActions = Object.keys(rebacSchema[model]?.actions ?? {});
  const allowed = pick ? schemaActions.filter((a) => pick.includes(a)) : schemaActions;
  if (allowed.length === 0) return z.never().nullable().optional();
  return z
    .record(z.enum(allowed as [string, ...string[]]), actionRuleSchema)
    .nullable()
    .optional();
};
