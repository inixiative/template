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
import type { ActionRule, RebacSchema } from '@template/permissions/rebac/types';

const rebacCheck = createRebacCheck(schemaMap);

export const check = (
  permix: Permix,
  schema: RebacSchema,
  model: AccessorName,
  record: HydratedRecord,
  actionOrRule: ActionRule,
  data?: Record<string, HydratedRecord[]>,
  visited?: Set<string>,
): boolean =>
  rebacCheck(permix, schema, { resource: `db:${model}`, record, data }, actionOrRule, visited);
