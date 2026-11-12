import { hydrate } from '@template/db';
import { type ActionRule, check, rebacSchema } from '@template/permissions/rebac';
import { makeError } from '#/lib/errors';
import { makeMiddleware } from '#/lib/utils/makeMiddleware';

export const validatePermission = makeMiddleware<ActionRule>((action) => async (c, next) => {
  const resource = c.get('resource');
  const resourceType = c.get('resourceType');
  const permix = c.get('permix');

  if (!resource || !resourceType)
    throw new Error(`validatePermission(${JSON.stringify(action)}) needs a loaded resource`);

  const hydrated = await hydrate(resourceType, resource as { id: string });

  if (!check(permix, rebacSchema, resourceType, hydrated, action)) {
    throw makeError({ status: 403, message: 'Access denied' });
  }

  await next();
});
