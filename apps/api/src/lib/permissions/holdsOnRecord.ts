/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses infrastructure:prisma, primitive:authz
 */
import { type AccessorName, type HydratedRecord, hydrate } from '@template/db';
import type { Permix } from '@template/permissions/client';
import { type ActionRule, check, schemaMap } from '@template/permissions/rebac';

export const holdsOnRecord = async (
  permix: Permix,
  model: AccessorName,
  record: Record<string, unknown>,
  action: ActionRule,
): Promise<boolean> =>
  check(permix, schemaMap, model, await hydrate(model, record as HydratedRecord), action);
