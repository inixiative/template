/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import { createRebacCheck, type PermixLike, type ResolveModel } from '@inixiative/permissions';
import type { AccessorName, HydratedRecord } from '@template/db';
import { prismaMap } from '@template/db/generated/prismaMap';
import type { Permix } from '@template/permissions/client';
import type { ActionRule, RebacSchema } from '@template/permissions/rebac/types';
import { lowerFirst, upperFirst } from 'lodash-es';

// The one app-specific seam: resolve which model a relation field points at, from the generated
// prisma map. The rebac/abac/rbac walk + cycle detection are imported from @inixiative/permissions
// (single source of truth) — this file injects the resolver, it does not reimplement the engine.
// Typed over AccessorName so the engine enforces our model union end-to-end (schema, model, walk).
const resolveModel: ResolveModel<AccessorName> = (sourceAccessor, relationName) => {
  const modelEntry = prismaMap.models[upperFirst(sourceAccessor) as keyof typeof prismaMap.models];
  if (!modelEntry) return null;

  const field = (modelEntry.fields as Record<string, { kind: string; type?: string }>)[relationName];
  if (field?.kind !== 'object') return null;
  if (!field.type) return null;

  return lowerFirst(field.type) as AccessorName;
};

const rebacCheck = createRebacCheck<AccessorName>(resolveModel);

// Template-typed adapter over the imported engine. Instantiating the engine with AccessorName makes
// the schema / model / walk all enforce our model union, so the only remaining bridge is permix:
// its `check` narrows `resource` to AccessorName, which (as a property-typed function) is contra-
// variantly incompatible with the engine's `string`-resource contract — sound at runtime, so cast.
export const check = (
  permix: Permix,
  schema: RebacSchema,
  model: AccessorName,
  record: HydratedRecord,
  actionOrRule: ActionRule,
  visited?: Set<string>,
): boolean => rebacCheck(permix as PermixLike, schema, model, record, actionOrRule, visited);
