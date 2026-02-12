import type { QueryKey } from '@tanstack/query-core';
import type { UseMutationOptions } from '@tanstack/react-query';
import { useAppStore } from '@template/ui/store';
import { useMutation } from '@template/ui/hooks/useQuery';

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
export const useOptimisticMutation = <TData, TError = Error, TVariables = void, TQueryData = unknown>(options: {
  /** The mutation function */
  mutationFn: (variables: TVariables) => Promise<TData>;
  /** Query key to invalidate on success/error */
  queryKey: QueryKey;
  /**
   * Function to optimistically update cached data.
   * Receives current cached data and mutation variables.
   * Return the new cached data shape.
   */
  optimisticUpdate: (currentData: TQueryData | undefined, variables: TVariables) => TQueryData;
  /** Additional mutation options */
  mutationOptions?: Omit<
    UseMutationOptions<TData, TError, TVariables, { previousData: TQueryData | undefined }>,
    'mutationFn' | 'onMutate' | 'onError' | 'onSettled'
  >;
}) => {
  const queryClient = useAppStore((state) => state.client);
  const { mutationFn, queryKey, optimisticUpdate, mutationOptions } = options;

  return useMutation<TData, TError, TVariables, { previousData: TQueryData | undefined }>({
    mutationFn,

    onMutate: async (variables) => {
      // Cancel outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey });

      // Snapshot current value
      const previousData = queryClient.getQueryData<TQueryData>(queryKey);

      // Optimistically update cache
      queryClient.setQueryData<TQueryData>(queryKey, (old) => optimisticUpdate(old, variables));

      // Return context for rollback
      return { previousData };
    },

    onError: (_error, _variables, context) => {
      // Rollback to previous value on error
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },

    onSettled: () => {
      // Invalidate to refetch real data regardless of success/error
      queryClient.invalidateQueries({ queryKey });
    },

    ...mutationOptions,
  });
};

/**
 * Simplified optimistic mutation for list operations.
 * Handles common patterns: create, update, delete items from a list.
 * Supports OpenAPI-style parameters: { path: { id }, body?: {...} }
 * Operation names match controller/route naming conventions.
 *
 * Expects SDK response shape: { data: TItem | void, request, response }
 * Extracts .data internally for optimistic updates and return value.
 *
 * TODO: Add support for 'lookup' operation to handle fetching and caching
 * individual items without modifying the list (e.g., for detail views that
 * need to optimistically show cached data while fetching fresh updates).
 */
export const useOptimisticListMutation = <
  TItem extends { id: string },
  TVariables = unknown,
>(options: {
  mutationFn: (variables: TVariables) => Promise<{ data: TItem | void; request: Request; response: Response }>;
  queryKey: QueryKey;
  /** 'create' | 'update' | 'delete' - matches controller naming. TODO: Add 'lookup' for fetching individual items */
  operation: 'create' | 'update' | 'delete';
  mutationOptions?: Omit<
    UseMutationOptions<TItem | void, Error, TVariables, { previousData: TItem[] | undefined }>,
    'mutationFn' | 'onMutate' | 'onError' | 'onSettled'
  >;
}) => {
  const { operation, mutationFn, ...rest } = options;

  return useOptimisticMutation<TItem | void, Error, TVariables, TItem[]>({
    ...rest,
    mutationFn: async (variables) => {
      const result = await mutationFn(variables);
      return result.data;
    },
    optimisticUpdate: (currentData, variables) => {
      const list = currentData ?? [];
      const vars = variables as Record<string, unknown>;
      const path = vars.path as Record<string, string> | undefined;
      const body = vars.body as Record<string, unknown> | undefined;
      const id = path?.id;

      switch (operation) {
        case 'create':
          return [...list, { ...body, id: '__optimistic__' } as TItem];
        case 'update':
          if (!id) return list;
          return list.map((item) => (item.id === id ? { ...item, ...body } : item));
        case 'delete':
          if (!id) return list;
          return list.filter((item) => item.id !== id);
        default:
          return list;
      }
    },
  });
};
