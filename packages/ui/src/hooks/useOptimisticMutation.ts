/**
 * @atlas
 * @kind hook
 * @partOf primitive:ui
 * @uses none
 */
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
  reconcile?: (currentData: unknown, response: unknown, variables: TVariables) => unknown;
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

export const useOptimisticMutation = <TData, TError = Error, TVariables = void>(options: {
  mutationFn: (variables: TVariables) => Promise<TData>;
  targets: OptimisticTargets<TVariables>;
  mutationOptions?: Omit<
    UseMutationOptions<TData, TError, TVariables, OptimisticContext<TVariables>>,
    'mutationFn' | 'onMutate' | 'onError' | 'onSettled'
  >;
}) => {
  const queryClient = useQueryClient();
  const { mutationFn, targets } = options;
  const { onSuccess, ...mutationOptions } = options.mutationOptions ?? {};

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

    onSuccess: (response, variables, context, mutationContext) => {
      for (const target of context?.resolvedTargets ?? []) {
        const { reconcile } = target;
        if (!reconcile) continue;
        queryClient.setQueryData(target.queryKey, (current: unknown) =>
          reconcile(current, response, variables),
        );
      }
      return onSuccess?.(response, variables, context, mutationContext);
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

const OPTIMISTIC_ID = '__optimistic__';

const isWrappedList = (currentData: unknown): currentData is { data: unknown[] } =>
  currentData !== undefined && !Array.isArray(currentData) && 'data' in (currentData as object);

const readList = <TItem>(currentData: unknown): TItem[] =>
  ((isWrappedList(currentData) ? currentData.data : currentData) as TItem[] | undefined) ?? [];

const writeList = <TItem>(currentData: unknown, updated: TItem[]): unknown =>
  isWrappedList(currentData) ? { ...currentData, data: updated } : updated;

const isInfiniteList = (currentData: unknown): currentData is { pages: unknown[] } =>
  currentData !== undefined &&
  !Array.isArray(currentData) &&
  Array.isArray((currentData as { pages?: unknown }).pages);

const updateList = <TItem>(
  currentData: unknown,
  update: (list: TItem[], isLastPage: boolean) => TItem[],
): unknown => {
  if (!isInfiniteList(currentData))
    return writeList(currentData, update(readList<TItem>(currentData), true));
  const lastPage = currentData.pages.length - 1;
  return {
    ...currentData,
    pages: currentData.pages.map((page, index) =>
      writeList(page, update(readList<TItem>(page), index === lastPage)),
    ),
  };
};

export const createOptimisticListTarget = <
  TItem extends { id: string },
  TVariables = unknown,
  TResponse = { data: TItem },
>(options: {
  queryKey: QueryKey;
  operation: OptimisticListOperation;
  optimisticExtras?: Partial<TItem>;
  itemFromResponse?: (response: TResponse) => TItem;
}) => {
  const { operation, optimisticExtras, queryKey } = options;
  const itemFromResponse =
    options.itemFromResponse ?? ((response: TResponse) => (response as { data: TItem }).data);

  return {
    queryKey,
    reconcile:
      operation === 'create'
        ? (currentData: unknown, response: unknown) => {
            const created = itemFromResponse(response as TResponse);
            return updateList<TItem>(currentData, (list) =>
              list.flatMap((item) =>
                item.id !== OPTIMISTIC_ID ? [item] : created ? [created] : [],
              ),
            );
          }
        : undefined,
    optimisticUpdate: (currentData, variables) => {
      const vars = variables as Record<string, unknown>;
      const path = vars.path as Record<string, string> | undefined;
      const body = vars.body as Record<string, unknown> | undefined;
      const id = path?.id;

      return updateList<TItem>(currentData, (list, isLastPage) => {
        switch (operation) {
          case 'create':
            return isLastPage
              ? [...list, { ...body, ...optimisticExtras, id: OPTIMISTIC_ID } as TItem]
              : list;
          case 'update':
            return !id ? list : list.map((item) => (item.id === id ? { ...item, ...body } : item));
          case 'delete':
            return !id ? list : list.filter((item) => item.id !== id);
          default:
            return list;
        }
      });
    },
  } satisfies OptimisticTarget<TVariables>;
};
