import { useMutation, useQueryClient, type UseMutationOptions, type QueryKey } from '@tanstack/react-query';

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
export function useOptimisticMutation<
  TData,
  TError = Error,
  TVariables = void,
  TQueryData = unknown,
>(options: {
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
}) {
  const queryClient = useQueryClient();
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
}

/**
 * Simplified optimistic mutation for list operations.
 * Handles common patterns: create, update, delete items from a list.
 * Operation names match controller/route naming conventions.
 */
export function useOptimisticListMutation<
  TItem extends { id: string },
  TError = Error,
  TVariables extends Partial<TItem> & { id: string } = Partial<TItem> & { id: string },
>(options: {
  mutationFn: (variables: TVariables) => Promise<TItem>;
  queryKey: QueryKey;
  /** 'create' | 'update' | 'delete' - matches controller naming */
  operation: 'create' | 'update' | 'delete';
  mutationOptions?: Omit<
    UseMutationOptions<TItem, TError, TVariables, { previousData: TItem[] | undefined }>,
    'mutationFn' | 'onMutate' | 'onError' | 'onSettled'
  >;
}) {
  const { operation, ...rest } = options;

  return useOptimisticMutation<TItem, TError, TVariables, TItem[]>({
    ...rest,
    optimisticUpdate: (currentData, variables) => {
      const list = currentData ?? [];

      switch (operation) {
        case 'create':
          return [...list, variables as unknown as TItem];
        case 'update':
          return list.map((item) => (item.id === variables.id ? { ...item, ...variables } : item));
        case 'delete':
          return list.filter((item) => item.id !== variables.id);
        default:
          return list;
      }
    },
  });
}
