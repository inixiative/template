import type { Context } from 'hono';
import { makeMiddleware } from '#/lib/utils/makeMiddleware';
import { mergeNarrowingWheres, type WhereScope } from '#/middleware/resources/mergeNarrowingWheres';
import type { AppEnv } from '#/types/appEnv';

type Scope = (c: Context<AppEnv>) => WhereScope | Promise<WhereScope>;

export const scopeNarrowing = makeMiddleware<Scope>((scope) => async (c, next) => {
  const current = c.get('filterLens');
  if (!current) throw new Error('scopeNarrowing: no narrowing on context — declare a `narrowing` on the route');
  c.set('filterLens', mergeNarrowingWheres(current, await scope(c)));
  await next();
});
