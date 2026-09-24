/**
 * @atlas
 * @kind middleware
 * @partOf primitive:requestContext
 * @uses none
 */
import type { LensNarrowing } from '@inixiative/json-rules';
import type { Context, MiddlewareHandler } from 'hono';
import { makeMiddleware } from '#/lib/utils/makeMiddleware';
import type { AppEnv } from '#/types/appEnv';

// A per-request scope contributes the same fields a narrowing layer carries.
export type WhereScope = Pick<LensNarrowing, 'root' | 'mapDefaults'>;
type Scope = (c: Context<AppEnv>) => WhereScope | Promise<WhereScope>;

const PER_CALLER_SCOPE = Symbol('perCallerScope');

export const isPerCallerScope = (middleware: unknown): boolean =>
  typeof middleware === 'function' && PER_CALLER_SCOPE in middleware;

export const scopeNarrowing = makeMiddleware<Scope>((scope) =>
  Object.assign(
    async (c: Context<AppEnv>, next: () => Promise<void>) => {
      const current = c.get('filterLens');
      if (!current) throw new Error('scopeNarrowing: no narrowing on context — declare a `narrowing` on the route');
      const { root, mapDefaults } = await scope(c);
      c.set('filterLens', { parent: current, root, mapDefaults });
      await next();
    },
    { [PER_CALLER_SCOPE]: true },
  ),
) as (scope: Scope) => MiddlewareHandler;
