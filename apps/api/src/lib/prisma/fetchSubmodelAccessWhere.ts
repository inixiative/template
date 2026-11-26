/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses primitive:authz
 */
import { fieldOf } from '@inixiative/field-map';
import { db, type HydratedRecord, hydrate, resourceOfModel, toModelName } from '@template/db';
import { prismaMap } from '@template/db/generated/prismaMap';
import { check, reachableFrom, schemaMap } from '@template/permissions/rebac';
import type { Context } from 'hono';
import { pseudoRecordOfSubmodel } from '#/lib/permissions/pseudoRecordOfSubmodel';
import { submodelOwnerWhere } from '#/lib/prisma/submodelOwnerWhere';
import type { AppEnv } from '#/types/appEnv';

const enumValuesFor = (model: string, fieldName: string): readonly string[] => {
  const field = fieldOf(prismaMap, model, fieldName);
  if (field?.kind !== 'enum' || !field.values?.length) {
    throw new Error(`${model} has no enum ${fieldName} field`);
  }
  return field.values;
};

export const fetchSubmodelAccessWhere = async (
  c: Context<AppEnv>,
): Promise<Record<string, unknown>> => {
  const { submodel, pseudoRecord } = pseudoRecordOfSubmodel(c);
  const ownerWhere = submodelOwnerWhere(c);
  const model = toModelName(submodel);
  const readAccessValues = enumValuesFor(model, 'readAccess');
  const operateAccessValues = enumValuesFor(model, 'operateAccess');

  const permix = c.get('permix');
  const hydrated = await hydrate(submodel, { id: '', ...pseudoRecord } as HydratedRecord);

  const fullReadAccess: string[] = [];
  const partialClauses: Record<string, unknown>[] = [];
  for (const readAccess of readAccessValues) {
    const allowedOps = operateAccessValues.filter((operateAccess) =>
      check(permix, submodel, { ...hydrated, readAccess, operateAccess } as HydratedRecord, 'read'),
    );
    if (allowedOps.length === operateAccessValues.length) {
      fullReadAccess.push(readAccess);
    } else if (allowedOps.length > 0) {
      partialClauses.push({ readAccess, operateAccess: { in: allowedOps } });
    }
  }
  if (fullReadAccess.length === readAccessValues.length) return ownerWhere;

  const resource = resourceOfModel(submodel);
  const directCandidateIds = new Set<string>();
  for (const action of reachableFrom(schemaMap, resource, 'read')) {
    for (const entitlement of permix.entitlements(resource, action)) {
      if (
        entitlement.anchor.resource === resource &&
        entitlement.anchor.path === undefined &&
        entitlement.anchor.id
      ) {
        directCandidateIds.add(entitlement.anchor.id);
      }
    }
  }

  const grantedIds: string[] = [];
  if (directCandidateIds.size > 0) {
    const candidates = (await db.delegate(submodel).findMany({
      where: { ...ownerWhere, id: { in: [...directCandidateIds] } },
    })) as HydratedRecord[];
    const hydratedCandidates = await Promise.all(candidates.map((row) => hydrate(submodel, row)));
    for (const row of hydratedCandidates) {
      if (check(permix, submodel, row, 'read') && typeof row.id === 'string') {
        grantedIds.push(row.id);
      }
    }
  }

  const orClauses: Record<string, unknown>[] = [
    ...(fullReadAccess.length > 0 ? [{ readAccess: { in: fullReadAccess } }] : []),
    ...partialClauses,
    ...(grantedIds.length > 0 ? [{ id: { in: grantedIds } }] : []),
  ];

  if (orClauses.length === 0) return { ...ownerWhere, id: { in: [] } };
  if (orClauses.length === 1) return { ...ownerWhere, ...orClauses[0] };
  return { ...ownerWhere, OR: orClauses };
};
