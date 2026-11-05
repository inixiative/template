/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz
 * @uses primitive:authz, infrastructure:prisma
 */
import { type AccessorName, isAccessorName, toModelName } from '@template/db';
import { placeUnder, schemaMap } from '@template/permissions/rebac';
import type { Context } from 'hono';
import type { AppEnv } from '#/types/appEnv';

export type SubmodelPlacement = { submodel: AccessorName; placed: Record<string, unknown> };

export const placeSubmodel = (c: Context<AppEnv>): SubmodelPlacement => {
  const submodel = c.get('routeConfig')?.submodel;
  const owner = c.get('resource') as Record<string, unknown> | null;
  const ownerType = c.get('resourceType');
  if (!submodel || !isAccessorName(submodel) || !owner || !ownerType)
    throw new Error(
      `placeSubmodel needs a route with a model submodel and a loaded owner (got submodel ${submodel}, owner ${ownerType})`,
    );

  const [placed] = placeUnder(schemaMap, `db:${submodel}`, ownerType, `db:${ownerType}`, owner, {
    field: 'ownerModel',
    operator: 'equals',
    value: toModelName(ownerType),
  });
  if (!placed) throw new Error(`${submodel} cannot be placed under ${ownerType}`);
  return { submodel, placed };
};
