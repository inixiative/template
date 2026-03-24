import type { QueryFunctionContext } from '@tanstack/react-query';
import { useAppStore } from '@template/ui/store';
import type { TenantContext } from '@template/ui/store/types/tenant';

type Organization = NonNullable<TenantContext['organization']>;
type Space = NonNullable<TenantContext['space']>;
type User = NonNullable<ReturnType<typeof useAppStore.getState>['auth']['user']>;

export type QuerySlot<TData = unknown> = {
  queryKey: readonly unknown[];
  queryFn: (context: QueryFunctionContext) => Promise<TData>;
};

export type MutationSlot<TVars = unknown, TData = unknown> = {
  mutationFn: (vars?: TVars) => Promise<TData>;
};

export type Slot = QuerySlot | MutationSlot;

/** Extracts the return type from a function type */
// biome-ignore lint/suspicious/noExplicitAny: conditional type inference requires any for the args position
type FnReturn<T> = T extends (...args: any[]) => infer R ? R : never;

/** Resolves the return type for a specific scope key in the map */
type ScopeReturn<TMap, K extends string> = K extends keyof TMap ? FnReturn<TMap[K]> : never;

/**
 * Distributes over TType to produce per-context return types.
 * When TType is a union (e.g. 'user' | 'organization'), the conditional
 * distributes and produces the union of matching scope return types.
 * When narrowed to a single literal, resolves to that scope's exact type.
 */
type ContextResult<TMap, TType extends string> = TType extends 'public'
  ? ScopeReturn<TMap, 'public'>
  : TType extends 'user'
    ? ScopeReturn<TMap, 'user'>
    : TType extends 'organization'
      ? ScopeReturn<TMap, 'organization'>
      : TType extends 'space'
        ? ScopeReturn<TMap, 'space'>
        : never;

type ContextScopeMap<P = undefined> = {
  public?: (args: undefined, params?: P) => Record<string, unknown>;
  user?: (args: { user: User }, params?: P) => Record<string, unknown>;
  organization?: (args: { organization: Organization }, params?: P) => Record<string, unknown>;
  space?: (args: { organization: Organization; space: Space }, params?: P) => Record<string, unknown>;
};

/**
 * Creates context-aware query/mutation factories that dispatch to
 * the correct scope (user/org/space) based on the tenant context.
 *
 * The return type narrows per-context via distributive conditional types:
 * - Full TenantContext → union of all scope return types
 * - Narrowed context (e.g. after `if (context.type === 'user')`) → that scope's exact type
 *
 * Use the curried form to specify params type: `makeContextQueries<ParamsType>()({...})`
 */
export const makeContextQueries =
  <P = undefined>() =>
  <TMap extends ContextScopeMap<P>>(scopeMap: TMap) =>
  <TContext extends TenantContext>(context: TContext, params?: P): ContextResult<TMap, TContext['type']> => {
    if (context.type === 'public' && scopeMap.public) {
      return scopeMap.public(undefined, params) as ContextResult<TMap, TContext['type']>;
    }
    if (context.type === 'space' && context.space && scopeMap.space) {
      return scopeMap.space({ organization: context.organization!, space: context.space }, params) as ContextResult<
        TMap,
        TContext['type']
      >;
    }
    if (context.type === 'organization' && context.organization && scopeMap.organization) {
      return scopeMap.organization({ organization: context.organization }, params) as ContextResult<
        TMap,
        TContext['type']
      >;
    }
    if (context.type === 'user' && scopeMap.user) {
      const user = useAppStore.getState().auth.user;
      if (user) return scopeMap.user({ user }, params) as ContextResult<TMap, TContext['type']>;
    }
    throw new Error(`No scope registered for context: ${context.type}`);
  };
