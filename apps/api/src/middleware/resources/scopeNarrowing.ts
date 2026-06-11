/**
 * @atlas
 * @kind middleware
 * @partOf primitive:requestContext
 * @uses none
 */
import type { LensNarrowing } from '@inixiative/json-rules';
import type { Context } from 'hono';
import { makeMiddleware } from '#/lib/utils/makeMiddleware';
import type { AppEnv } from '#/types/appEnv';

// A per-request scope contributes the same fields a narrowing layer carries.
export type WhereScope = Pick<LensNarrowing, 'root' | 'mapDefaults'>;
type Scope = (c: Context<AppEnv>) => WhereScope | Promise<WhereScope>;

export const scopeNarrowing = makeMiddleware<Scope>((scope) => async (c, next) => {
  const current = c.get('filterLens');
  if (!current) throw new Error('scopeNarrowing: no narrowing on context — declare a `narrowing` on the route');
  const { root, mapDefaults } = await scope(c);
  // Stack the scope as a child narrowing layer under the route's filterLens.
  // buildWhereClause composes the whole chain via projectByPath.
  c.set('filterLens', { parent: current, root, mapDefaults });
  await next();
});
