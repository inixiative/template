import type { QueryKey, UseMutationOptions } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
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
export const useOptimisticListMutation = <TItem extends { id: string }, TVariables = unknown>(options: {
  mutationFn: (variables: TVariables) => Promise<{ data: TItem | undefined | void; request: Request; response: Response }>;
  queryKey: QueryKey;
  /** 'create' | 'update' | 'delete' - matches controller naming. TODO: Add 'lookup' for fetching individual items */
  operation: 'create' | 'update' | 'delete';
  /** Extra fields merged into the optimistic item on create (e.g. derived fields the API would normally compute) */
  optimisticExtras?: Partial<TItem>;
  mutationOptions?: Omit<
    UseMutationOptions<TItem | undefined, Error, TVariables, { previousData: TItem[] | undefined }>,
    'mutationFn' | 'onMutate' | 'onError' | 'onSettled'
  >;
}) => {
  const { operation, optimisticExtras, mutationFn, ...rest } = options;

  return useOptimisticMutation<TItem | undefined, Error, TVariables, TItem[]>({
    ...rest,
    mutationFn: async (variables) => {
      const result = await mutationFn(variables);
      return result.data as TItem | undefined;
    },
    optimisticUpdate: (currentData, variables) => {
      // Cache may be a plain array or a wrapped { data: TItem[], ... } shape
      const isWrapped = currentData !== undefined && !Array.isArray(currentData) && 'data' in (currentData as object);
      const list: TItem[] = (isWrapped ? (currentData as { data: TItem[] }).data : currentData) ?? [];

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

      return (isWrapped ? { ...(currentData as object), data: updated } : updated) as TItem[];
    },
  });
};
