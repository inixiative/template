/**
 * @atlas
 * @kind validator, middleware
 * @partOf primitive:authz
 * @uses infrastructure:prisma, primitive:errors
 */
import { type HydratedRecord, hydrate } from '@template/db';
import type { Action } from '@template/permissions/client';
import { check, rebacSchema } from '@template/permissions/rebac';
import type { MiddlewareHandler } from 'hono';
import { makeError } from '#/lib/errors';
import { placeSubmodel } from '#/lib/permissions/placeSubmodel';
import type { AppEnv } from '#/types/appEnv';

export const validateSubmodelPermission =
  (action: Action): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const { submodel, placed } = placeSubmodel(c);
    const pseudo = await hydrate(submodel, { id: '', ...placed } as HydratedRecord);
    if (!check(c.get('permix'), rebacSchema, submodel, pseudo, action))
      throw makeError({ status: 403, message: 'Access denied' });

    await next();
  };
