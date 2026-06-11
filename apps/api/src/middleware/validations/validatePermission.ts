/**
 * @atlas
 * @kind validator, middleware
 * @partOf primitive:authz
 */
import type { AccessorName } from '@template/db';
import { db, hydrate } from '@template/db';
import type { Action } from '@template/permissions/client';
import { check, rebacSchema } from '@template/permissions/rebac';
import { makeError } from '#/lib/errors';
import { makeMiddleware } from '#/lib/utils/makeMiddleware';

export const validatePermission = makeMiddleware<Action>((action) => async (c, next) => {
  const resource = c.get('resource');
  const resourceType = c.get('resourceType') as AccessorName | undefined;
  const permix = c.get('permix');

  // No resource loaded = nothing to check (let route handle it)
  if (!resource || !resourceType) return next();

  // Hydrate with relations for ReBAC traversal (org → space, etc.)
  const hydrated = await hydrate(db, resourceType, resource as { id: string });

  if (!check(permix, rebacSchema, resourceType, hydrated, action)) {
    throw makeError({ status: 403, message: 'Access denied' });
  }

  await next();
});
