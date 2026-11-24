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
import { pseudoRecordOfSubmodel } from '#/lib/permissions/pseudoRecordOfSubmodel';
import type { AppEnv } from '#/types/appEnv';

export const validateSubmodelPermission =
  (action: Action): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const { submodel, pseudoRecord } = pseudoRecordOfSubmodel(c);
    if (!(await holdsOnRecord(c.get('permix'), submodel, { id: '', ...pseudoRecord }, action)))
      throw makeError({ status: 403, message: 'Access denied' });

    await next();
  };
