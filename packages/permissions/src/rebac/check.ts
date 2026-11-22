/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import { createRebacCheck } from '@inixiative/permissions';
import type { AccessorName, HydratedRecord } from '@template/db';
import { schemaMap } from '@template/db/schemaMap';
import type { Permix } from '@template/permissions/client';
import { tenantPermissionRulesAbove } from '@template/permissions/rebac/tenantPermissionRules';
import type { ActionRule, RebacSchema } from '@template/permissions/rebac/types';

const rebacCheck = createRebacCheck(schemaMap, { additionalRules: tenantPermissionRulesAbove });

const rowsOfActor = (permix: Permix): Record<string, Record<string, unknown>[]> => {
  const actor = permix.getActor();
  return actor
    ? { 'actor:Acting': [{ model: actor.model }], [`actor:${actor.model}`]: [actor.record] }
    : {};
};

/** A rule stored beside the schema's (a row's, or a tenant's above it) that the library refuses: its owner has to set it again. */
export class StoredPermissionRuleRefusedError extends Error {}

export const check = (
  permix: Permix,
  schema: RebacSchema,
  model: AccessorName,
  record: HydratedRecord,
  actionOrRule: ActionRule,
  data?: Record<string, HydratedRecord[]>,
): boolean => {
  try {
    return rebacCheck(
      permix,
      schema,
      { resource: `db:${model}`, record, data: { ...data, ...rowsOfActor(permix) } },
      actionOrRule,
    );
  } catch (error) {
    // why: the library throws a plain Error; its message is the only mark of a refused stored rule
    if (error instanceof Error && error.message.includes("beside the schema's is refused"))
      throw new StoredPermissionRuleRefusedError(error.message, { cause: error });
    throw error;
  }
};
