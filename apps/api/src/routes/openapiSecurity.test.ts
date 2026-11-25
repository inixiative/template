import { describe, expect, it } from 'bun:test';
import { app } from '#/app';

type Operation = {
  operationId?: string;
  security?: Array<Record<string, unknown>>;
  'x-forbid-tokens'?: boolean;
  'x-forbid-jwt'?: boolean;
  'x-forbid-spoof'?: boolean;
  'x-forbid-batch'?: boolean;
};

type Spec = {
  components?: { securitySchemes?: Record<string, Record<string, unknown>> };
  paths?: Record<string, Record<string, Operation>>;
};

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

const expectedSchemes = (path: string, op: Operation): string[] => {
  if (path.startsWith('/api/internal')) return ['internalSecret'];
  const schemes: string[] = [];
  if (!op['x-forbid-jwt']) schemes.push('userJwt');
  if (!op['x-forbid-tokens']) schemes.push('apiToken');
  return schemes;
};

const fetchSpec = async (): Promise<Spec> => {
  const res = await app.request('/openapi/docs');
  expect(res.status).toBe(200);
  return (await res.json()) as Spec;
};

const operations = (spec: Spec) =>
  Object.entries(spec.paths ?? {}).flatMap(([path, item]) =>
    METHODS.filter((method) => item[method]).map((method) => ({
      path,
      method,
      op: item[method] as Operation,
    })),
  );

describe('OpenAPI security', () => {
  it('publishes the three credential schemes the API accepts', async () => {
    const spec = await fetchSpec();
    const schemes = spec.components?.securitySchemes ?? {};

    expect(Object.keys(schemes).sort()).toEqual(['apiToken', 'internalSecret', 'userJwt']);
    expect(schemes.userJwt).toMatchObject({ type: 'http', scheme: 'bearer' });
    expect(schemes.apiToken).toMatchObject({ type: 'http', scheme: 'bearer' });
    expect(schemes.internalSecret).toMatchObject({
      type: 'apiKey',
      in: 'header',
      name: 'x-internal-secret',
    });
  });

  it('declares security on every operation, matching its middleware and x-forbid-* extensions', async () => {
    const spec = await fetchSpec();
    const registered = Object.keys(spec.components?.securitySchemes ?? {});
    const all = operations(spec);

    expect(all.length).toBeGreaterThan(0);

    const wrong = all
      .map(({ path, method, op }) => {
        const expectedSecurity = expectedSchemes(path, op).map((name) => ({
          [name]: [],
        }));
        const ok =
          Array.isArray(op.security) &&
          JSON.stringify(op.security) === JSON.stringify(expectedSecurity);
        return ok
          ? null
          : `${method.toUpperCase()} ${path} (${op.operationId}): expected ${JSON.stringify(expectedSecurity)}, got ${JSON.stringify(op.security)}`;
      })
      .filter((entry): entry is string => entry !== null);

    expect(wrong).toEqual([]);
    expect(spec.paths?.['/api/v1/me/twoFactor/verify']?.post).toMatchObject({
      security: [{ userJwt: [] }],
      'x-forbid-tokens': true,
      'x-forbid-batch': true,
    });
    expect(spec.paths?.['/api/v1/me/twoFactor/totp/start']?.post).toMatchObject({
      security: [{ userJwt: [] }],
      'x-forbid-tokens': true,
      'x-forbid-spoof': true,
      'x-forbid-batch': true,
    });

    const unregistered = all
      .flatMap(({ path, op }) =>
        (op.security ?? []).flatMap((requirement) =>
          Object.keys(requirement).map((name) => ({ path, name })),
        ),
      )
      .filter(({ name }) => !registered.includes(name));

    expect(unregistered).toEqual([]);
  });
});
