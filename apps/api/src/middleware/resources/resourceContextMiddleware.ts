import { toModelName, type ExtendedPrismaClient, type ModelDelegate } from '@template/db';
import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { resourceContextArgs } from '#/middleware/resources/resourceContextArgs';

export const resourceContextMiddleware = (): MiddlewareHandler => async (c, next) => {
  const id = c.req.param('id');
  if (!id) return next();

  const db = c.get('db');
  const lookup = c.req.query('lookup') || 'id';

  // Get delegate from route path (e.g., /api/v1/organization/:id → 'organization')
  const pathParts = c.req.path.split('/');
  const delegate = pathParts[3] as ModelDelegate | undefined;
  if (!delegate || !toModelName(delegate)) return next();

  const resources = await findResources(db, delegate, lookup, id);

  if (!resources.length) throw new HTTPException(404, { message: 'Resource not found' });
  if (resources.length > 1) throw new HTTPException(409, { message: 'Multiple resources found' });

  c.set('resource', resources[0]);
  c.set('resourceType', delegate);

  return next();
};

const findResources = async (db: ExtendedPrismaClient, delegate: ModelDelegate, lookup: string, id: string) => {
  const model = db[delegate] as { findMany: Function } | undefined;
  if (!model?.findMany) return [];

  return model.findMany({
    where: { [lookup]: id },
    ...resourceContextArgs[delegate],
  });
};
