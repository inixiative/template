/**
 * @atlas
 * @kind utils
 * @uses primitive:shared, primitive:routeTemplates
 */
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { OpenAPIHono, RouteConfig } from '@hono/zod-openapi';
import { log } from '@template/shared/logger';
import { toOpenApi } from '#/lib/routeTemplates/utils';
import type { AppEnv } from '#/types/appEnv';

export const autoRegisterRoutes = async (
  router: OpenAPIHono<AppEnv>,
  moduleDir: string,
  options?: { admin?: boolean; internal?: boolean; skip?: string[] },
): Promise<void> => {
  const routesDir = resolve(moduleDir, 'routes');
  const controllersDir = resolve(moduleDir, 'controllers');

  const routeFiles = readdirSync(routesDir).filter(
    (f) => f.endsWith('.ts') && !f.endsWith('.test.ts'),
  );

  const prefix = options?.admin ? 'admin' : options?.internal ? 'internal' : '';
  const registrations = [];

  for (const file of routeFiles) {
    const baseName = file.replace('.ts', '');

    if (prefix && !baseName.startsWith(prefix)) continue;
    // No prefix → only pick up the unprefixed surface, never admin* or internal*.
    if (!prefix && (baseName.startsWith('admin') || baseName.startsWith('internal'))) continue;
    if (options?.skip?.includes(baseName)) continue;

    const routeModule = await import(`${routesDir}/${file}`);
    const controllerModule = await import(`${controllersDir}/${file}`);

    const route = routeModule.default || routeModule[`${baseName}Route`];
    const controller = controllerModule.default || controllerModule[`${baseName}Controller`];

    if (!route || !controller) {
      log.warn(`Skipping ${baseName}: route or controller not found`);
      continue;
    }

    registrations.push({ route: route as RouteConfig, controller });
  }

  registrations.sort((left, right) => {
    const leftSegments = left.route.path.split('/');
    const rightSegments = right.route.path.split('/');
    for (const [index, leftSegment] of leftSegments.entries()) {
      const rightSegment = rightSegments[index];
      if (rightSegment === undefined) break;
      const leftPriority = leftSegment.startsWith('*') ? 2 : /^[{:]/.test(leftSegment) ? 1 : 0;
      const rightPriority = rightSegment.startsWith('*') ? 2 : /^[{:]/.test(rightSegment) ? 1 : 0;
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      if (leftPriority === 0 && leftSegment !== rightSegment) {
        return leftSegment.localeCompare(rightSegment);
      }
    }
    return leftSegments.length - rightSegments.length;
  });

  for (const { route, controller } of registrations) {
    router.openapi(toOpenApi(route), controller);
  }
};

export const autoRegisterAdminRoutes = async (
  router: OpenAPIHono<AppEnv>,
  modulePath: string,
): Promise<void> => {
  return autoRegisterRoutes(router, modulePath, { admin: true });
};

export const autoRegisterInternalRoutes = async (
  router: OpenAPIHono<AppEnv>,
  modulePath: string,
): Promise<void> => {
  return autoRegisterRoutes(router, modulePath, { internal: true });
};
