import { describe, expect, it } from 'bun:test';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { Condition, LensNarrowing } from '@inixiative/json-rules';
import { lensFor } from '@template/db/lens';
import { scopeNarrowing } from '#/middleware/resources/scopeNarrowing';
import type { AppEnv } from '#/types/appEnv';

const inquiryNarrowing = (): LensNarrowing => ({
  parent: lensFor('Inquiry'),
  maps: { prisma: { models: { Inquiry: { picks: ['type'] } } } },
});

const ruleA: Condition = { field: 'a', operator: 'equals', value: 1 };
const ruleB: Condition = { field: 'b', operator: 'equals', value: 2 };

describe('scopeNarrowing', () => {
  it('AND-merges scope.where into narrowing on ctx', async () => {
    const app = new OpenAPIHono<AppEnv>();
    app.use('*', async (c, next) => {
      c.set('narrowing', inquiryNarrowing());
      await next();
    });
    app.get(
      '/check',
      scopeNarrowing(() => ({ where: ruleA })),
      (c) => c.json({ where: c.get('narrowing')?.where ?? null }),
    );
    const res = await app.fetch(new Request('http://test/check'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ where: ruleA });
  });

  it('passes hono context to the scope callback', async () => {
    let capturedPath: string | undefined;
    const app = new OpenAPIHono<AppEnv>();
    app.use('*', async (c, next) => {
      c.set('narrowing', inquiryNarrowing());
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
      c.set('narrowing', inquiryNarrowing());
      await next();
    });
    app.get(
      '/check',
      scopeNarrowing(() => ({ where: ruleA })),
      scopeNarrowing(() => ({ where: ruleB })),
      (c) => c.json({ where: c.get('narrowing')?.where ?? null }),
    );
    const res = await app.fetch(new Request('http://test/check'));
    expect(await res.json()).toEqual({ where: { all: [ruleA, ruleB] } });
  });

  it('merges relations and defaults slots through to ctx narrowing', async () => {
    const app = new OpenAPIHono<AppEnv>();
    app.use('*', async (c, next) => {
      c.set('narrowing', inquiryNarrowing());
      await next();
    });
    app.get(
      '/check',
      scopeNarrowing(() => ({ relations: { sourceUser: ruleA }, defaults: { User: ruleB } })),
      (c) => {
        const n = c.get('narrowing')!;
        return c.json({
          rel: n.maps.default.models.Inquiry.relations?.sourceUser.where ?? null,
          def: n.maps.default.defaults?.models?.User.where ?? null,
        });
      },
    );
    const res = await app.fetch(new Request('http://test/check'));
    expect(await res.json()).toEqual({ rel: ruleA, def: ruleB });
  });
});
