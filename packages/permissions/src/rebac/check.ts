/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import { createRebacCheck } from '@inixiative/permissions';
import { type AccessorName, type HydratedRecord, resourceOfModel } from '@template/db';
import type { Permix } from '@template/permissions/client';
import { tenantPermissionRulesAbove } from '@template/permissions/rebac/tenantPermissionRules';
import type { ActionRule, SchemaMap } from '@template/permissions/rebac/types';
import { memoize } from 'lodash-es';

const rebacCheckOf = memoize((map: SchemaMap) =>
  createRebacCheck(map, { additionalRules: tenantPermissionRulesAbove }),
);

const rowsOfActor = (permix: Permix): Record<string, Record<string, unknown>[]> => {
  const actor = permix.getActor();
  return actor
    ? { 'actor:Acting': [{ model: actor.model }], [`actor:${actor.model}`]: [actor.record] }
    : {};
};

export const check = (
  permix: Permix,
  map: SchemaMap,
  model: AccessorName,
  record: HydratedRecord,
  actionOrRule: ActionRule,
  data?: Record<string, HydratedRecord[]>,
): boolean =>
  rebacCheckOf(map)(
    permix,
    { resource: resourceOfModel(model), record, data: { ...data, ...rowsOfActor(permix) } },
    actionOrRule,
  );
