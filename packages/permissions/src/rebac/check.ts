/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import { createRebacCheck, type PermixLike, type ResolveRelation } from '@inixiative/permissions';
import type { AccessorName, HydratedRecord } from '@template/db';
import { prismaMap } from '@template/db/generated/prismaMap';
import type { Permix } from '@template/permissions/client';
import type { ActionRule, RebacSchema } from '@template/permissions/rebac/types';
import { lowerFirst, upperFirst } from 'lodash-es';

const resolveRelation: ResolveRelation = (resource, relationName) => {
  const accessor = resource.split(':')[1] ?? resource;
  const modelEntry = prismaMap.models[upperFirst(accessor) as keyof typeof prismaMap.models];
  if (!modelEntry) return null;

  const field = (modelEntry.fields as Record<string, { kind: string; type?: string }>)[relationName];
  if (field?.kind !== 'object') return null;
  if (!field.type) return null;

  return `db:${lowerFirst(field.type)}`;
};

const rebacCheck = createRebacCheck(resolveRelation);

export const check = (
  permix: Permix,
  schema: RebacSchema,
  model: AccessorName,
  record: HydratedRecord,
  actionOrRule: ActionRule,
  data?: Record<string, HydratedRecord[]>,
  visited?: Set<string>,
): boolean =>
  rebacCheck(permix as PermixLike, schema, { resource: `db:${model}`, record, data }, actionOrRule, visited);
