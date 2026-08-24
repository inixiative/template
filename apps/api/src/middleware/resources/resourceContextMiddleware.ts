/**
 * @atlas
 * @kind middleware
 * @partOf primitive:requestContext
 * @uses infrastructure:prisma, primitive:shared, primitive:errors
 */
import { type AccessorName, type Db, toModelName } from '@template/db';
import { isUuidV7 } from '@template/shared/utils';
import type { MiddlewareHandler } from 'hono';
import { isSuperadmin } from '#/lib/context/isSuperadmin';
import { makeError } from '#/lib/errors';
import { liveIncludes, liveWhere } from '#/lib/prisma/softDeleteScope';
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
  const modelName = accessor ? toModelName(accessor) : undefined;
  if (!accessor || !modelName) return next();

  // Soft-deleted rows are invisible outside superadmin — enforced once here for
  // every resource route instead of per-controller deletedAt checks. Revival
  // flows go through create-path upserts on unique keys, never load-by-id.
  const superadmin = isSuperadmin(c);
  const base: Record<string, unknown> = { [lookup]: id };
  const where = superadmin ? base : liveWhere(modelName, base);

  const resources = await findResources(db, accessor, where, superadmin ? undefined : modelName);

  if (!resources.length) throw makeError({ status: 404, message: 'Resource not found' });
  if (resources.length > 1) throw makeError({ status: 409, message: 'Multiple resources found' });

  c.set('resource', resources[0]);
  c.set('resourceType', accessor);

  return next();
};

const findResources = async (db: Db, accessor: AccessorName, where: Record<string, unknown>, scopeModel?: string) => {
  const delegate = db[accessor] as { findMany: (...args: unknown[]) => Promise<unknown[]> } | undefined;
  if (!delegate?.findMany) return [];

  const args = { ...resourceContextArgs[accessor] } as Record<string, unknown>;
  if (scopeModel) {
    for (const key of ['include', 'select'] as const) {
      const tree = args[key];
      if (tree && typeof tree === 'object') args[key] = liveIncludes(scopeModel, tree as Record<string, unknown>);
    }
  }

  return delegate.findMany({ where, ...args });
};
