/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import {
  createRebacCheck,
  type RebacSchema as EngineSchema,
  type PermixLike,
  type ResolveModel,
} from '@inixiative/permissions';
import type { AccessorName, HydratedRecord } from '@template/db';
import { prismaMap } from '@template/db/generated/prismaMap';
import type { Permix } from '@template/permissions/client';
import type { ActionRule, RebacSchema } from '@template/permissions/rebac/types';
import { lowerFirst, upperFirst } from 'lodash-es';

// The one app-specific seam: resolve which model a relation field points at, from the generated
// prisma map. The rebac/abac/rbac walk + cycle detection are imported from @inixiative/permissions
// (single source of truth) — this file injects the resolver, it does not reimplement the engine.
const resolveModel: ResolveModel = (sourceAccessor, relationName) => {
  const modelEntry = prismaMap.models[upperFirst(sourceAccessor) as keyof typeof prismaMap.models];
  if (!modelEntry) return null;

  const field = (modelEntry.fields as Record<string, { kind: string; type?: string }>)[relationName];
  if (field?.kind !== 'object') return null;
  if (!field.type) return null;

  return lowerFirst(field.type);
};

const rebacCheck = createRebacCheck(resolveModel);

// Template-typed adapter over the imported engine: narrows models to AccessorName and accepts
// HydratedRecord, while the engine stays generic over string models. The lone bridge is the schema
// cast (AccessorName-keyed → string-keyed); permix / record / rule are structurally compatible.
export const check = (
  permix: Permix,
  schema: RebacSchema,
  model: AccessorName,
  record: HydratedRecord,
  actionOrRule: ActionRule,
  visited?: Set<string>,
): boolean => rebacCheck(permix as PermixLike, schema as EngineSchema, model, record, actionOrRule, visited);
