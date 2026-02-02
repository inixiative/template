import { toModelName, type AccessorName, type Db } from '@template/db';
import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { resourceContextArgs } from '#/middleware/resources/resourceContextArgs';

export const resourceContextMiddleware = (): MiddlewareHandler => async (c, next) => {
  const id = c.req.param('id');
  if (!id) return next();

  const db = c.get('db');
  const lookup = c.req.query('lookup') || 'id';

  // Get accessor from route path (e.g., /api/v1/organization/:id → 'organization')
  const pathParts = c.req.path.split('/');
  const accessor = pathParts[3] as AccessorName | undefined;
  if (!accessor || !toModelName(accessor)) return next();

  const resources = await findResources(db, accessor, lookup, id);

  if (!resources.length) throw new HTTPException(404, { message: 'Resource not found' });
  if (resources.length > 1) throw new HTTPException(409, { message: 'Multiple resources found' });

  c.set('resource', resources[0]);
  c.set('resourceType', accessor);

  return next();
};

const findResources = async (db: Db, accessor: AccessorName, lookup: string, id: string) => {
  const delegate = db[accessor] as { findMany: Function } | undefined;
  if (!delegate?.findMany) return [];

  return delegate.findMany({
    where: { [lookup]: id },
    ...resourceContextArgs[accessor],
  });
};
