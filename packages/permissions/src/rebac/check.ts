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

const rowsOfActor = (permix: Permix): Record<string, Record<string, unknown>[]> => {
  const actor = permix.getActor();
  return actor
    ? { 'actor:Acting': [{ model: actor.model }], [`actor:${actor.model}`]: [actor.record] }
    : {};
};

export const check = (
  permix: Permix,
  schema: RebacSchema,
  model: AccessorName,
  record: HydratedRecord,
  actionOrRule: ActionRule,
  data?: Record<string, HydratedRecord[]>,
): boolean =>
  rebacCheck(
    permix,
    schema,
    { resource: `db:${model}`, record, data: { ...data, ...rowsOfActor(permix) } },
    actionOrRule,
  );
