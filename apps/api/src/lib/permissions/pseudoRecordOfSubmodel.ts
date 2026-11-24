/**
 * @atlas
 * @kind utils
 * @partOf primitive:authz
 * @uses primitive:authz, infrastructure:prisma
 */
import { type AccessorName, isAccessorName, resourceOfModel, toModelName } from '@template/db';
import { pseudoRecordsBelowAnchor, schemaMap } from '@template/permissions/rebac';
import type { Context } from 'hono';
import type { AppEnv } from '#/types/appEnv';

export type SubmodelPseudoRecord = {
  submodel: AccessorName;
  pseudoRecord: Record<string, unknown>;
};

export const pseudoRecordOfSubmodel = (c: Context<AppEnv>): SubmodelPseudoRecord => {
  const submodel = c.get('routeConfig')?.submodel;
  const owner = c.get('resource') as Record<string, unknown> | null;
  const ownerType = c.get('resourceType');
  if (!submodel || !isAccessorName(submodel) || !owner || !ownerType)
    throw new Error(
      `pseudoRecordOfSubmodel needs a route with a model submodel and a loaded owner (got submodel ${submodel}, owner ${ownerType})`,
    );

  const [pseudoRecord] = pseudoRecordsBelowAnchor(
    schemaMap,
    resourceOfModel(submodel),
    ownerType,
    resourceOfModel(ownerType),
    owner,
    { field: 'ownerModel', operator: 'equals', value: toModelName(ownerType) },
  );
  if (!pseudoRecord) throw new Error(`${submodel} has no pseudo record under ${ownerType}`);
  return { submodel, pseudoRecord };
};
