import { z } from 'zod';

// Recursive Zod schema for an `ActionRule` envelope. Validates the SHAPE only:
// - delegation strings, { rel, action }, { self }, { any }, { all } structures
// - the inner json-rules Condition under `{ rule: ... }` is passed through as
//   unknown — runtime json-rules `check()` validates it when the rule fires.
const actionRuleSchema: z.ZodType = z.lazy(() =>
  z.union([
    z.string(), // delegate to another action on the same model
    z.null(),
    z.object({ rel: z.string(), action: z.string() }).strict(),
    z.object({ self: z.string() }).strict(),
    z.object({ rule: z.unknown() }).strict(),
    z.object({ any: z.array(actionRuleSchema) }).strict(),
    z.object({ all: z.array(actionRuleSchema) }).strict(),
  ]),
);

/**
 * Build a Zod schema for a `permissionRules: Json?` column on a model with a
 * known set of action keys. Used at the API boundary to validate client input
 * for resources whose owners can author per-row permission overrides.
 *
 * @param overridableActions Action names whose row-level rules clients may set.
 *                           Typically a subset like `['read']` — granting
 *                           additional `manage`/`delete` paths via row rules
 *                           is usually not desired (effectively transfers
 *                           ownership). Models choose what's safe to expose.
 *
 * @example
 *   permissionRules: buildPermissionRulesSchema(['read']),
 *   // Accepts: { read: { self: 'userId' } }, { read: { all: [] } }
 *   // Rejects: { delete: ... }, { read: { foo: 'bar' } }, arbitrary JSON
 */
export const buildPermissionRulesSchema = <T extends string>(overridableActions: readonly T[]) =>
  z
    .record(
      z.enum(overridableActions as readonly [T, ...T[]]),
      actionRuleSchema,
    )
    .nullable()
    .optional();
