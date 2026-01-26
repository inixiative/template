import { toModelName } from '@template/db';
import type { Context, MiddlewareHandler, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';

export function resourceContextMiddleware(): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const id = c.req.param('id');
    if (!id) return next();

    const db = c.get('db');
    const lookup = c.req.query('lookup') || 'id';

    // Get model accessor from route path (e.g., /api/v1/organization/:id → organization)
    const pathParts = c.req.path.split('/');
    const modelAccessor = pathParts[3];
    if (!modelAccessor) return next();

    // Validate it's a known Prisma model
    const modelName = toModelName(modelAccessor);
    if (!modelName) return next();

    // Check if model exists on prisma client
    const model = (db as Record<string, unknown>)[modelAccessor];
    if (!model || typeof model !== 'object') return next();

    const findMany = (model as Record<string, unknown>).findMany;
    if (typeof findMany !== 'function') return next();

    const resources = await findMany({ where: { [lookup]: id } });

    if (!resources.length) {
      throw new HTTPException(404, { message: 'Resource not found' });
    }

    if (resources.length > 1) {
      throw new HTTPException(400, { message: 'Multiple resources found for lookup field' });
    }

    c.set('resource', resources[0]);
    c.set('resourceType', modelAccessor);

    return next();
  };
}
