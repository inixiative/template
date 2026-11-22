/**
 * @atlas
 * @kind validator, middleware
 * @partOf primitive:authz
 * @uses infrastructure:prisma, primitive:errors
 */
import type { Action } from '@template/permissions/client';
import type { MiddlewareHandler } from 'hono';
import { makeError } from '#/lib/errors';
import { holdsOnRecord } from '#/lib/permissions/holdsOnRecord';
import { placeSubmodel } from '#/lib/permissions/placeSubmodel';
import type { AppEnv } from '#/types/appEnv';

export const validateSubmodelPermission =
  (action: Action): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const { submodel, placed } = placeSubmodel(c);
    if (!(await holdsOnRecord(c.get('permix'), submodel, { id: '', ...placed }, action)))
      throw makeError({ status: 403, message: 'Access denied' });

    await next();
  };
