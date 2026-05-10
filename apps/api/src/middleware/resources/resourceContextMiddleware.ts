import { type AccessorName, type Db, toModelName } from '@template/db';
import { isUuidV7 } from '@template/shared/utils';
import type { MiddlewareHandler } from 'hono';
import { makeError } from '#/lib/errors';
import { resourceContextArgs } from '#/middleware/resources/resourceContextArgs';

export const resourceContextMiddleware = (): MiddlewareHandler => async (c, next) => {
  const id = c.req.param('id');
  if (!id) return next();

  const db = c.get('db');
  const lookup = c.req.query('lookup') || 'id';

  // When addressing by id (default), enforce uuidv7 here — the schema is
  // intentionally lax to allow `?lookup=<otherField>` to pass arbitrary
  // strings (slugs, jids, externalIds, etc.). All schema ids are dbgenerated
  // as uuidv7, so anything else is a malformed request.
  if (lookup === 'id' && !isUuidV7(id)) {
    throw makeError({
      status: 400,
      message: 'id must be a uuidv7 (or pass `?lookup=<field>` to address by another column)',
    });
  }

  // Get accessor from route path (e.g., /api/v1/organization/:id → 'organization')
  const pathParts = c.req.path.split('/');
  const accessor = pathParts[3] as AccessorName | undefined;
  if (!accessor || !toModelName(accessor)) return next();

  const resources = await findResources(db, accessor, lookup, id);

  if (!resources.length) throw makeError({ status: 404, message: 'Resource not found' });
  if (resources.length > 1) throw makeError({ status: 409, message: 'Multiple resources found' });

  c.set('resource', resources[0]);
  c.set('resourceType', accessor);

  return next();
};

const findResources = async (db: Db, accessor: AccessorName, lookup: string, id: string) => {
  const delegate = db[accessor] as { findMany: (...args: unknown[]) => Promise<unknown[]> } | undefined;
  if (!delegate?.findMany) return [];

  return delegate.findMany({
    where: { [lookup]: id },
    ...resourceContextArgs[accessor],
  });
};
