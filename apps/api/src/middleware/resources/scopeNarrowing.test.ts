import { describe, expect, it } from 'bun:test';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { Condition, LensNarrowing } from '@inixiative/json-rules';
import { lensFor } from '@template/db/lens';
import { scopeNarrowing } from '#/middleware/resources/scopeNarrowing';
import type { AppEnv } from '#/types/appEnv';

const inquiryNarrowing = (): LensNarrowing => ({
  parent: lensFor('Inquiry'),
  root: { picks: ['type'] },
});

const ruleA: Condition = { field: 'a', operator: 'equals', value: 1 };
const ruleB: Condition = { field: 'b', operator: 'equals', value: 2 };

describe('scopeNarrowing', () => {
  it('AND-merges scope.root.where into narrowing on ctx', async () => {
    const app = new OpenAPIHono<AppEnv>();
    app.use('*', async (c, next) => {
      c.set('filterLens', inquiryNarrowing());
      await next();
    });
    app.get(
      '/check',
      scopeNarrowing(() => ({ root: { where: ruleA } })),
      (c) => c.json({ where: c.get('filterLens')?.root?.where ?? null }),
    );
    const res = await app.fetch(new Request('http://test/check'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ where: ruleA });
  });

  it('passes hono context to the scope callback', async () => {
    let capturedPath: string | undefined;
    const app = new OpenAPIHono<AppEnv>();
    app.use('*', async (c, next) => {
      c.set('filterLens', inquiryNarrowing());
      await next();
    });
    app.get(
      '/inquiry/abc',
      scopeNarrowing((c) => {
        capturedPath = c.req.path;
        return {};
      }),
      (c) => c.json({ ok: true }),
    );
    await app.fetch(new Request('http://test/inquiry/abc'));
    expect(capturedPath).toBe('/inquiry/abc');
  });

  it('multiple scopeNarrowing middlewares compose AND-merge in order', async () => {
    const app = new OpenAPIHono<AppEnv>();
    app.use('*', async (c, next) => {
      c.set('filterLens', inquiryNarrowing());
      await next();
    });
    app.get(
      '/check',
      scopeNarrowing(() => ({ root: { where: ruleA } })),
      scopeNarrowing(() => ({ root: { where: ruleB } })),
      (c) => c.json({ where: c.get('filterLens')?.root?.where ?? null }),
    );
    const res = await app.fetch(new Request('http://test/check'));
    expect(await res.json()).toEqual({ where: { all: [ruleA, ruleB] } });
  });

  it('merges root.relations and mapDefaults slots through to ctx narrowing', async () => {
    const app = new OpenAPIHono<AppEnv>();
    app.use('*', async (c, next) => {
      c.set('filterLens', inquiryNarrowing());
      await next();
    });
    app.get(
      '/check',
      scopeNarrowing(() => ({
        root: { relations: { sourceUser: { where: ruleA } } },
        mapDefaults: { prisma: { models: { User: { where: ruleB } } } },
      })),
      (c) => {
        const n = c.get('filterLens')!;
        return c.json({
          rel: n.root?.relations?.sourceUser.where ?? null,
          def: n.mapDefaults?.prisma?.models?.User.where ?? null,
        });
      },
    );
    const res = await app.fetch(new Request('http://test/check'));
    expect(await res.json()).toEqual({ rel: ruleA, def: ruleB });
  });

  it('awaits async scope callbacks (for integration-source lookups)', async () => {
    const app = new OpenAPIHono<AppEnv>();
    app.use('*', async (c, next) => {
      c.set('filterLens', inquiryNarrowing());
      await next();
    });
    app.get(
      '/check',
      scopeNarrowing(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return { root: { where: ruleA } };
      }),
      (c) => c.json({ where: c.get('filterLens')?.root?.where ?? null }),
    );
    const res = await app.fetch(new Request('http://test/check'));
    expect(await res.json()).toEqual({ where: ruleA });
  });
});
