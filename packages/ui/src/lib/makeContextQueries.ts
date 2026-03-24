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

/** Normalizes a query slot — widens queryKey so T unifies across scopes */
export const query = <TData>(slot: QuerySlot<TData>): QuerySlot<TData> => slot;

/** Normalizes a mutation slot */
export const mutation = <TVars, TData>(slot: MutationSlot<TVars, TData>): MutationSlot<TVars, TData> => slot;

type ContextScopeMap<T, P> = {
  public?: (args: undefined, params?: P) => T;
  user?: (args: { user: User }, params?: P) => T;
  organization?: (args: { organization: Organization }, params?: P) => T;
  space?: (args: { organization: Organization; space: Space }, params?: P) => T;
};

/**
 * Context-aware query/mutation factory. Dispatches to the correct scope
 * (user/org/space) at runtime. All scopes must return the same shape T.
 *
 * Curried: `makeContextQueries<ParamsType>()({...})` or `makeContextQueries()({...})`
 */
export const makeContextQueries =
  <P = undefined>() =>
  <T>(scopeMap: ContextScopeMap<T, P>) =>
  (context: TenantContext, params?: P): T => {
    if (context.type === 'public' && scopeMap.public) {
      return scopeMap.public(undefined, params);
    }
    if (context.type === 'space' && context.space && scopeMap.space) {
      return scopeMap.space({ organization: context.organization!, space: context.space }, params);
    }
    if (context.type === 'organization' && context.organization && scopeMap.organization) {
      return scopeMap.organization({ organization: context.organization }, params);
    }
    if (context.type === 'user' && scopeMap.user) {
      const user = useAppStore.getState().auth.user;
      if (user) return scopeMap.user({ user }, params);
    }
    throw new Error(`No scope registered for context: ${context.type}`);
  };
