import { useAppStore } from '@template/ui/store';
import type { TenantContext } from '@template/ui/store/types/tenant';

type Organization = NonNullable<TenantContext['organization']>;
type Space = NonNullable<TenantContext['space']>;
type User = NonNullable<ReturnType<typeof useAppStore.getState>['auth']['user']>;

// biome-ignore lint/suspicious/noExplicitAny: generic constraint — any required to match any SDK function signature
type AnySdkFn = (...args: any[]) => Promise<any>;

// biome-ignore lint/suspicious/noExplicitAny: generic constraint — any required to match any SDK function signature
export type QuerySlot = { queryKey: readonly unknown[]; queryFn: (...args: any[]) => Promise<any> };
export type MutationSlot = { mutationFn: AnySdkFn };
export type Slot = QuerySlot | MutationSlot;

export type ScopeConfig = {
  readMany?: QuerySlot;
  read?: QuerySlot;
  create?: MutationSlot;
  update?: MutationSlot;
  delete?: MutationSlot;
  [key: string]: Slot | undefined;
};

type ContextScopeMap<T extends ScopeConfig, P = undefined> = {
  public?: (args: undefined, params?: P) => T;
  user?: (args: { user: User }, params?: P) => T;
  organization?: (args: { organization: Organization }, params?: P) => T;
  space?: (args: { organization: Organization; space: Space }, params?: P) => T;
};

export const makeContextQueries =
  // biome-ignore lint/suspicious/noExplicitAny: generic params constraint
    <T extends ScopeConfig, P = any>(scopeMap: ContextScopeMap<T, P>) =>
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
