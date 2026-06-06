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

  const routeFiles = readdirSync(routesDir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));

  const prefix = options?.admin ? 'admin' : options?.internal ? 'internal' : '';

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

    router.openapi(toOpenApi(route as RouteConfig), controller);
  }
};

export const autoRegisterAdminRoutes = async (router: OpenAPIHono<AppEnv>, modulePath: string): Promise<void> => {
  return autoRegisterRoutes(router, modulePath, { admin: true });
};

export const autoRegisterInternalRoutes = async (router: OpenAPIHono<AppEnv>, modulePath: string): Promise<void> => {
  return autoRegisterRoutes(router, modulePath, { internal: true });
};
