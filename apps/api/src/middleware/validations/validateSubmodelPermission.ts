/**
 * @atlas
 * @kind validator, middleware
 * @partOf primitive:authz
 * @uses infrastructure:prisma, primitive:errors
 */
import { hydrate, isAccessorName, ownerRef } from '@template/db';
import type { Action } from '@template/permissions/client';
import { check, rebacSchema } from '@template/permissions/rebac';
import type { MiddlewareHandler } from 'hono';
import { makeError } from '#/lib/errors';
import type { AppEnv } from '#/types/appEnv';

const submodelChecks = new WeakSet<MiddlewareHandler>();

export const isSubmodelCheck = (middleware: MiddlewareHandler): boolean =>
  submodelChecks.has(middleware);

export const validateSubmodelPermission = (action: Action): MiddlewareHandler<AppEnv> => {
  const handler: MiddlewareHandler<AppEnv> = async (c, next) => {
    const submodel = c.get('routeConfig')?.submodel;
    const owner = c.get('resource') as Record<string, unknown> | null;
    const ownerType = c.get('resourceType');
    if (!submodel || !isAccessorName(submodel) || !owner || !ownerType)
      throw new Error(
        `validateSubmodelPermission needs a route with a model submodel and a loaded owner (got submodel ${submodel}, owner ${ownerType})`,
      );

    const pseudo = await hydrate(submodel, ownerRef(submodel, ownerType, owner));
    if (!check(c.get('permix'), rebacSchema, submodel, pseudo, action))
      throw makeError({ status: 403, message: 'Access denied' });

    await next();
  };
  submodelChecks.add(handler as MiddlewareHandler);
  return handler;
};
