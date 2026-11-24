/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import { makeRebacCheck } from '@inixiative/permissions';
import { type AccessorName, type HydratedRecord, resourceOfModel } from '@template/db';
import type { Permix } from '@template/permissions/client';
import { schemaMap } from '@template/permissions/rebac/schema';
import { storedPermissionRules } from '@template/permissions/rebac/storedPermissionRules';
import type { ActionRule, SchemaMap } from '@template/permissions/rebac/types';

const rowsOfActor = (permix: Permix): Record<string, Record<string, unknown>[]> => {
  const actor = permix.getActor();
  return actor
    ? { 'actor:Acting': [{ model: actor.model }], [`actor:${actor.model}`]: [actor.record] }
    : {};
};

export const makeCheck = (schemaMapOfTheCheck: SchemaMap) => {
  const rebacCheck = makeRebacCheck(schemaMapOfTheCheck, {
    additionalRules: storedPermissionRules,
  });
  return (
    permix: Permix,
    model: AccessorName,
    record: HydratedRecord,
    actionOrRule: ActionRule,
    bridgeData?: Record<string, HydratedRecord[]>,
  ): boolean =>
    rebacCheck(
      permix,
      {
        resource: resourceOfModel(model),
        record,
        bridgeData: { ...bridgeData, ...rowsOfActor(permix) },
      },
      actionOrRule,
    );
};

export const check = makeCheck(schemaMap);
