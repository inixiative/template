import { readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '#/types/appEnv';

export async function autoRegisterRoutes(
  router: OpenAPIHono<AppEnv>,
  moduleDir: string,
  options?: { admin?: boolean }
): Promise<void> {
  const routesDir = resolve(moduleDir, 'routes');
  const controllersDir = resolve(moduleDir, 'controllers');

  const routeFiles = readdirSync(routesDir).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));

  const prefix = options?.admin ? 'admin' : '';

  for (const file of routeFiles) {
    const baseName = file.replace('.ts', '');

    if (prefix && !baseName.startsWith(prefix)) continue;
    if (!prefix && baseName.startsWith('admin')) continue;

    const routeModule = await import(`${routesDir}/${file}`);
    const controllerModule = await import(`${controllersDir}/${file}`);

    const route = routeModule.default || routeModule[`${baseName}Route`];
    const controller = controllerModule.default || controllerModule[`${baseName}Controller`];

    if (!route || !controller) {
      console.warn(`Skipping ${baseName}: route or controller not found`);
      continue;
    }

    router.openapi(route, controller);
  }
}

export async function autoRegisterAdminRoutes(
  router: OpenAPIHono<AppEnv>,
  modulePath: string
): Promise<void> {
  return autoRegisterRoutes(router, modulePath, { admin: true });
}
