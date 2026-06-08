import { describe, expect, it } from 'bun:test';
import { OpenAPIHono } from '@hono/zod-openapi';
import { type Condition, type LensNarrowing, projectByPath } from '@inixiative/json-rules';
import { lensFor } from '@template/db/lens';
import { scopeNarrowing } from '#/middleware/resources/scopeNarrowing';
import type { AppEnv } from '#/types/appEnv';

const inquiryNarrowing = (): LensNarrowing => ({
  parent: lensFor('Inquiry'),
  root: { picks: ['type'] },
});

const ruleA: Condition = { field: 'a', operator: 'equals', value: 1 };
const ruleB: Condition = { field: 'b', operator: 'equals', value: 2 };

// The composed root-model wheres along the full narrowing chain — exactly what
// buildWhereClause reads off the stacked layers.
const composedWheres = (n: LensNarrowing): Condition[] => {
  const byPath = projectByPath(n) as Map<string, { whereClauses: Condition[] }>;
  const rootKey = byPath.keys().next().value;
  return rootKey ? (byPath.get(rootKey)?.whereClauses ?? []) : [];
};

// Run middlewares against a fresh app with inquiryNarrowing seeded on ctx; return the
// resulting filterLens captured after they ran.
const runMiddlewares = async (
  middlewares: ReturnType<typeof scopeNarrowing>[],
  path = '/check',
): Promise<LensNarrowing | undefined> => {
  let captured: LensNarrowing | undefined;
  const app = new OpenAPIHono<AppEnv>();
  app.use('*', async (c, next) => {
    c.set('filterLens', inquiryNarrowing());
    await next();
  });
  app.get(path, ...middlewares, (c) => {
    captured = c.get('filterLens');
    return c.json({ ok: true });
  });
  await app.fetch(new Request(`http://test${path}`));
  return captured;
};

describe('scopeNarrowing', () => {
  it('stacks scope.root.where as a child layer that composes onto the chain', async () => {
    const lens = await runMiddlewares([scopeNarrowing(() => ({ root: { where: ruleA } }))]);
    expect(lens?.root?.where).toEqual(ruleA);
    expect(composedWheres(lens!)).toEqual([ruleA]);
  });

  it('composes multiple scopeNarrowing layers in order', async () => {
    const lens = await runMiddlewares([
      scopeNarrowing(() => ({ root: { where: ruleA } })),
      scopeNarrowing(() => ({ root: { where: ruleB } })),
    ]);
    // The outermost layer carries ruleB; the chain composes both.
    expect(lens?.root?.where).toEqual(ruleB);
    const wheres = composedWheres(lens!);
    expect(wheres).toHaveLength(2);
    expect(wheres).toEqual(expect.arrayContaining([ruleA, ruleB]));
  });

  it('passes hono context to the scope callback', async () => {
    let capturedPath: string | undefined;
    await runMiddlewares(
      [
        scopeNarrowing((c) => {
          capturedPath = c.req.path;
          return {};
        }),
      ],
      '/inquiry/abc',
    );
    expect(capturedPath).toBe('/inquiry/abc');
  });

  it('stacks root.relations and mapDefaults onto the layer', async () => {
    const lens = await runMiddlewares([
      scopeNarrowing(() => ({
        root: { relations: { sourceUser: { where: ruleA } } },
        mapDefaults: { prisma: { models: { User: { where: ruleB } } } },
      })),
    ]);
    expect(lens?.root?.relations?.sourceUser.where).toEqual(ruleA);
    expect(lens?.mapDefaults?.prisma?.models?.User.where).toEqual(ruleB);
  });

  it('awaits async scope callbacks (for integration-source lookups)', async () => {
    const lens = await runMiddlewares([
      scopeNarrowing(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return { root: { where: ruleA } };
      }),
    ]);
    expect(composedWheres(lens!)).toEqual([ruleA]);
  });
});
