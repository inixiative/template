/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses primitive:authz, primitive:errors
 */
import { fieldOf } from '@inixiative/field-map';
import { db, type HydratedRecord, hydrate, resourceOfModel, toModelName } from '@template/db';
import { prismaMap } from '@template/db/generated/prismaMap';
import { check, reachableFrom, schemaMap } from '@template/permissions/rebac';
import type { Context } from 'hono';
import { makeError } from '#/lib/errors';
import { pseudoRecordOfSubmodel } from '#/lib/permissions/pseudoRecordOfSubmodel';
import { submodelOwnerWhere } from '#/lib/prisma/submodelOwnerWhere';
import type { AppEnv } from '#/types/appEnv';

export const fetchSubmodelVisibilityWhere = async (
  c: Context<AppEnv>,
): Promise<Record<string, unknown>> => {
  const { submodel, pseudoRecord } = pseudoRecordOfSubmodel(c);
  const ownerWhere = submodelOwnerWhere(c);
  const accessField = fieldOf(prismaMap, toModelName(submodel), 'access');
  if (accessField?.kind !== 'enum' || !accessField.values?.length) {
    throw new Error(`${submodel} has no enum access field`);
  }

  const permix = c.get('permix');
  const hydrated = await hydrate(submodel, { id: '', ...pseudoRecord } as HydratedRecord);
  const allowed = accessField.values.filter((access) =>
    check(permix, submodel, { ...hydrated, access } as HydratedRecord, 'read'),
  );
  if (allowed.length === accessField.values.length) return ownerWhere;

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

  if (allowed.length === 0 && grantedIds.length === 0) {
    throw makeError({ status: 403, message: 'Access denied' });
  }
  if (grantedIds.length === 0) return { ...ownerWhere, access: { in: allowed } };
  if (allowed.length === 0) return { ...ownerWhere, id: { in: grantedIds } };
  return { ...ownerWhere, OR: [{ access: { in: allowed } }, { id: { in: grantedIds } }] };
};
