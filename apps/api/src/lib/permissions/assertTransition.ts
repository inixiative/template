/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses infrastructure:prisma, primitive:authz, primitive:errors
 */
import { checkTransition, describe, type Reason } from '@inixiative/transitions';
import { type AccessorName, type HydratedRecord, hydrate, resourceOfModel } from '@template/db';
import type { Permix } from '@template/permissions/client';
import { check, schemaMap } from '@template/permissions/rebac';
import { transitions } from '@template/permissions/transitions';
import { makeError } from '#/lib/errors';

const failsOnlyOnPermission = (reason: Reason) =>
  reason.paths.some((path) => !path.from?.predicate && !path.to?.predicate);

export const assertTransition = async (
  permix: Permix,
  model: AccessorName,
  action: string,
  record: Record<string, unknown>,
  changes: Record<string, unknown>,
): Promise<void> => {
  const current = await hydrate(model, record as HydratedRecord);
  const result = checkTransition(transitions, resourceOfModel(model), action, current, changes, {
    authorize: (rule, row) => check(permix, schemaMap, model, row as HydratedRecord, rule),
  });
  if (result === true) return;
  if (failsOnlyOnPermission(result)) throw makeError({ status: 403, message: 'Access denied' });
  throw makeError({
    status: 409,
    message: `${action} is not allowed from this ${model}'s current state`,
    details: [{ reason: describe(result) }],
  });
};
