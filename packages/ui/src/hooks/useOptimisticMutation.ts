import type { QueryKey, UseMutationOptions } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { useMutation } from '@template/ui/hooks/useQuery';

type OptimisticSnapshot = {
  queryKey: QueryKey;
  previousData: unknown;
};

export type OptimisticTarget<TVariables> = {
  queryKey: QueryKey;
  optimisticUpdate: (currentData: unknown, variables: TVariables) => unknown;
  invalidateOnSettled?: boolean;
};

type OptimisticTargets<TVariables> =
  | OptimisticTarget<TVariables>[]
  | ((variables: TVariables) => OptimisticTarget<TVariables>[]);

type OptimisticContext<TVariables> = {
  snapshots: OptimisticSnapshot[];
  resolvedTargets: OptimisticTarget<TVariables>[];
};

export type OptimisticListOperation = 'create' | 'update' | 'delete';

const resolveTargets = <TVariables>(
  targets: OptimisticTargets<TVariables>,
  variables: TVariables,
): OptimisticTarget<TVariables>[] => {
  return typeof targets === 'function' ? targets(variables) : targets;
};

/**
 * Optimistic mutation wrapper for TanStack Query.
 *
 * Pattern:
 * 1. onMutate: Cache current state, optimistically update
 * 2. onError: Rollback to cached state
 * 3. onSettled: Invalidate to refetch real data
 *
 * @example
 * ```tsx
 * const updateTodo = useOptimisticMutation({
 *   mutationFn: (todo) => api.updateTodo(todo),
 *   queryKey: ['todos'],
 *   optimisticUpdate: (old, newTodo) =>
 *     old.map(t => t.id === newTodo.id ? { ...t, ...newTodo } : t),
 * });
 * ```
 */
export const useOptimisticMutation = <TData, TError = Error, TVariables = void>(options: {
  /** The mutation function */
  mutationFn: (variables: TVariables) => Promise<TData>;
  /** Cache targets to optimistically patch and invalidate */
  targets: OptimisticTargets<TVariables>;
  /** Additional mutation options */
  mutationOptions?: Omit<
    UseMutationOptions<TData, TError, TVariables, OptimisticContext<TVariables>>,
    'mutationFn' | 'onMutate' | 'onError' | 'onSettled'
  >;
}) => {
  const queryClient = useQueryClient();
  const { mutationFn, targets, mutationOptions } = options;

  return useMutation<TData, TError, TVariables, OptimisticContext<TVariables>>({
    mutationFn,

    onMutate: async (variables) => {
      const resolvedTargets = resolveTargets(targets, variables);
      const snapshots: OptimisticSnapshot[] = [];

      for (const target of resolvedTargets) {
        await queryClient.cancelQueries({ queryKey: target.queryKey });

        snapshots.push({
          queryKey: target.queryKey,
          previousData: queryClient.getQueryData(target.queryKey),
        });

        queryClient.setQueryData(target.queryKey, (old) => target.optimisticUpdate(old, variables));
      }

      return { snapshots, resolvedTargets };
    },

    onError: (_error, _variables, context) => {
      for (const snapshot of context?.snapshots ?? []) {
        queryClient.setQueryData(snapshot.queryKey, snapshot.previousData);
      }
    },

    onSettled: async (_data, _error, _variables, context) => {
      for (const target of context?.resolvedTargets ?? []) {
        if (target.invalidateOnSettled === false) continue;
        await queryClient.invalidateQueries({ queryKey: target.queryKey });
      }
    },

    ...mutationOptions,
  });
};

/**
 * Pure helper for building a single optimistic target for list create/update/delete operations.
 * Supports OpenAPI-style variables: { path: { id }, body?: {...} }.
 */
export const createOptimisticListTarget = <TItem extends { id: string }, TVariables = unknown>(options: {
  queryKey: QueryKey;
  operation: OptimisticListOperation;
  optimisticExtras?: Partial<TItem>;
}) => {
  const { operation, optimisticExtras, queryKey } = options;

  return {
    queryKey,
    optimisticUpdate: (currentData, variables) => {
      const isWrapped = currentData !== undefined && !Array.isArray(currentData) && 'data' in (currentData as object);
      const list: TItem[] =
        (isWrapped ? (currentData as { data: TItem[] }).data : (currentData as TItem[] | undefined)) ?? [];

      const vars = variables as Record<string, unknown>;
      const path = vars.path as Record<string, string> | undefined;
      const body = vars.body as Record<string, unknown> | undefined;
      const id = path?.id;

      let updated: TItem[];
      switch (operation) {
        case 'create':
          updated = [...list, { ...body, ...optimisticExtras, id: '__optimistic__' } as TItem];
          break;
        case 'update':
          updated = !id ? list : list.map((item) => (item.id === id ? { ...item, ...body } : item));
          break;
        case 'delete':
          updated = !id ? list : list.filter((item) => item.id !== id);
          break;
        default:
          updated = list;
      }

      return isWrapped ? { ...(currentData as object), data: updated } : updated;
    },
  } satisfies OptimisticTarget<TVariables>;
};
