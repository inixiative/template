/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import { makeRebacCheck } from '@inixiative/permissions';
import type { AccessorName, HydratedRecord } from '@template/db';
import type { Role } from '@template/db/generated/client/enums';
import { resourceOfModel } from '@template/db/utils/modelNames';
import type { Permix } from '@template/permissions/client';
import { schemaMap } from '@template/permissions/rebac/schema';
import { storedPermissionRules } from '@template/permissions/rebac/storedPermissionRules';
import type { ActionRule, SchemaMap } from '@template/permissions/rebac/types';
import { roleHierarchy, roleToStandardAction } from '@template/permissions/roles/shared';

const rowsOfActor = (permix: Permix): Record<string, Record<string, unknown>[]> => {
  const actor = permix.getActor();
  return {
    'actor:Clock': [{ now: new Date() }],
    ...(actor
      ? { 'actor:Acting': [{ model: actor.model }], [`actor:${actor.model}`]: [actor.record] }
      : {}),
  };
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

export const artifactEffectiveRole = (permix: Permix, hydrated: HydratedRecord): Role | null => {
  // why: public/tenant access is reported on effectiveReadAccess/effectiveOperateAccess, not synthesized as a role.
  const withoutAccess = {
    ...hydrated,
    effectiveReadAccess: 'private',
    effectiveOperateAccess: 'private',
  };
  for (const role of [...roleHierarchy].reverse()) {
    if (check(permix, 'artifact', withoutAccess, roleToStandardAction(role))) return role;
  }
  return null;
};
