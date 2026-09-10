import { describe, expect, it } from 'bun:test';
import { app } from '#/app';

type Operation = {
  operationId?: string;
  security?: Array<Record<string, unknown>>;
};

type Spec = {
  components?: { securitySchemes?: Record<string, Record<string, unknown>> };
  paths?: Record<string, Record<string, Operation>>;
};

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

const SESSION_ONLY = new Set([
  'meCreateToken',
  'organizationCreateToken',
  'organizationUserCreateToken',
  'spaceCreateToken',
  'spaceUserCreateToken',
  'organizationDelete',
  'tokenDelete',
]);

const expectedSchemes = (path: string, operationId: string | undefined): string[] => {
  if (path.startsWith('/api/internal')) return ['internalSecret'];
  if (operationId && SESSION_ONLY.has(operationId)) return ['sessionToken'];
  return ['sessionToken', 'apiToken'];
};

const loadSpec = async (): Promise<Spec> => {
  const res = await app.request('/openapi/docs');
  expect(res.status).toBe(200);
  return (await res.json()) as Spec;
};

const operations = (spec: Spec) =>
  Object.entries(spec.paths ?? {}).flatMap(([path, item]) =>
    METHODS.filter((method) => item[method]).map((method) => ({ path, method, op: item[method] as Operation })),
  );

describe('OpenAPI security', () => {
  it('publishes the three credential schemes the API accepts', async () => {
    const spec = await loadSpec();
    const schemes = spec.components?.securitySchemes ?? {};

    expect(Object.keys(schemes).sort()).toEqual(['apiToken', 'internalSecret', 'sessionToken']);
    expect(schemes.sessionToken).toMatchObject({ type: 'http', scheme: 'bearer' });
    expect(schemes.apiToken).toMatchObject({ type: 'http', scheme: 'bearer' });
    expect(schemes.internalSecret).toMatchObject({ type: 'apiKey', in: 'header', name: 'x-internal-secret' });
  });

  it('declares security on every operation, matching the middleware it mounts', async () => {
    const spec = await loadSpec();
    const registered = Object.keys(spec.components?.securitySchemes ?? {});
    const all = operations(spec);

    expect(all.length).toBeGreaterThan(0);

    const wrong = all
      .map(({ path, method, op }) => {
        const expectedSecurity = expectedSchemes(path, op.operationId).map((name) => ({ [name]: [] }));
        const ok = Array.isArray(op.security) && JSON.stringify(op.security) === JSON.stringify(expectedSecurity);
        return ok
          ? null
          : `${method.toUpperCase()} ${path} (${op.operationId}): expected ${JSON.stringify(expectedSecurity)}, got ${JSON.stringify(op.security)}`;
      })
      .filter((entry): entry is string => entry !== null);

    expect(wrong).toEqual([]);

    const unregistered = all
      .flatMap(({ path, op }) =>
        (op.security ?? []).flatMap((requirement) => Object.keys(requirement).map((name) => ({ path, name }))),
      )
      .filter(({ name }) => !registered.includes(name));

    expect(unregistered).toEqual([]);
  });

  it('publishes session-only auth where a token is refused, and both credentials elsewhere', async () => {
    const spec = await loadSpec();

    expect(spec.paths?.['/api/v1/me/tokens']?.post?.security).toEqual([{ sessionToken: [] }]);
    expect(spec.paths?.['/api/v1/me/contacts']?.post?.security).toEqual([{ sessionToken: [] }, { apiToken: [] }]);
  });
});
