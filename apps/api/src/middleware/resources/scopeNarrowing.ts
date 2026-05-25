import type { Context } from 'hono';
import { makeMiddleware } from '#/lib/utils/makeMiddleware';
import { mergeNarrowingWheres, type WhereScope } from '#/middleware/resources/mergeNarrowingWheres';
import type { AppEnv } from '#/types/appEnv';

type Scope = (c: Context<AppEnv>) => WhereScope;

export const scopeNarrowing = makeMiddleware<Scope>((scope) => async (c, next) => {
  const current = c.get('narrowing');
  if (!current) throw new Error('scopeNarrowing: no narrowing on context — declare a `narrowing` on the route');
  c.set('narrowing', mergeNarrowingWheres(current, scope(c)));
  await next();
});
