import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { toOpenApi } from '#/lib/routeTemplates/utils';
import { autoRegisterRoutes } from '#/lib/utils/autoRegisterRoutes';
import { adminSpaceReadManyRoute } from '#/modules/space/routes/adminSpaceReadMany';
import { createTestApp } from '#tests/createTestApp';

const moduleDir = mkdtempSync(resolve(tmpdir(), 'route-order-'));
mkdirSync(resolve(moduleDir, 'routes'));
mkdirSync(resolve(moduleDir, 'controllers'));

beforeAll(() => {
  const spaceRoutes = resolve(import.meta.dirname, '../../modules/space/routes');
  for (const [name, source, path] of [
    ['aResource', 'spaceRead', '/{id}'],
    ['zBriefing', 'adminSpaceReadMany', '/dashboard'],
    ['aGeneric', 'adminSpaceReadMany', '/{a}/{child}'],
    ['zAction', 'adminSpaceReadMany', '/{z}/detail'],
    ['wildcard', 'adminSpaceReadMany', '/*'],
    ['aPrefixWildcard', 'adminSpaceReadMany', '/foo/*'],
    ['zExact', 'adminSpaceReadMany', '/foo'],
  ] as const) {
    writeFileSync(
      resolve(moduleDir, 'routes', `${name}.ts`),
      `import { ${source}Route } from ${JSON.stringify(resolve(spaceRoutes, `${source}.ts`))}; export const ${name}Route = { ...${source}Route${path ? `, path: ${JSON.stringify(path)}` : ''} };`,
    );
    writeFileSync(
      resolve(moduleDir, 'controllers', `${name}.ts`),
      `export const ${name}Controller = c => c.json({ route: ${JSON.stringify(name)} });`,
    );
  }
});

afterAll(() => rmSync(moduleDir, { recursive: true, force: true }));

describe('autoRegisterRoutes', () => {
  it('registers static collection actions before resource routes regardless of file names', async () => {
    const { app: router } = createTestApp();
    await autoRegisterRoutes(router, moduleDir);
    const response = await router.request('/dashboard');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ route: 'zBriefing' });

    const invalidIdResponse = await router.request('/invalid-id');
    expect(invalidIdResponse.status).toBe(400);
    expect(await invalidIdResponse.json()).toMatchObject({
      message: 'id must be a uuidv7 (or pass `?lookup=<field>` to address by another column)',
    });
  });

  it('compares nested path specificity independently of parameter names', async () => {
    const { app: router } = createTestApp();
    await autoRegisterRoutes(router, moduleDir);
    const response = await router.request('/123/detail');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ route: 'zAction' });

    const exactResponse = await router.request('/foo');
    expect(exactResponse.status).toBe(200);
    expect(await exactResponse.json()).toEqual({ route: 'zExact' });
  });

  it('skips a route already mounted by hand, so it registers once and the hand mount serves it', async () => {
    const { app: router } = createTestApp();
    router.openapi(toOpenApi({ ...adminSpaceReadManyRoute, path: '/foo' }), (c) =>
      c.json({ route: 'byHand' }),
    );

    await autoRegisterRoutes(router, moduleDir);

    const registeredPaths = router.openAPIRegistry.definitions.flatMap((definition) =>
      definition.type === 'route' ? [`${definition.route.method} ${definition.route.path}`] : [],
    );
    expect(registeredPaths.filter((key) => key === 'get /foo')).toHaveLength(1);
    expect(router.routes.filter((route) => route.path === '/foo')).toHaveLength(
      router.routes.filter((route) => route.path === '/dashboard').length,
    );

    const response = await router.request('/foo');
    expect(await response.json()).toEqual({ route: 'byHand' });
  });
});
