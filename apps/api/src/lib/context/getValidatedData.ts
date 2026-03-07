import type { Context, Input } from 'hono';
import type { InputToDataByTarget, ValidationTargets } from 'hono/types';
import type { AppEnv } from '#/types/appEnv';

type ContextOut<C extends Context<any, any, any>> = C extends Context<any, any, infer I>
  ? I extends { out: infer O }
    ? O extends Input['out']
      ? O
      : {}
    : {}
  : {};

export type ValidatedContext<TTarget extends keyof ValidationTargets, TData = unknown> = Context<
  AppEnv,
  any,
  { out: Record<TTarget, TData> }
>;

export function getValidatedBody<C extends ValidatedContext<'json', unknown>>(
  c: C,
): InputToDataByTarget<ContextOut<C>, 'json'>;
export function getValidatedBody<T = Record<string, unknown>>(c: Context<AppEnv>): T;
export function getValidatedBody<T = Record<string, unknown>>(c: Context<AppEnv>): T {
  return c.req.valid('json' as never) as T;
}

export function getValidatedQuery<C extends ValidatedContext<'query', unknown>>(
  c: C,
): InputToDataByTarget<ContextOut<C>, 'query'>;
export function getValidatedQuery<T = Record<string, unknown>>(c: Context<AppEnv>): T;
export function getValidatedQuery<T = Record<string, unknown>>(c: Context<AppEnv>): T {
  return c.req.valid('query' as never) as T;
}
