import {
  useQuery as tanstackUseQuery,
  useMutation as tanstackUseMutation,
  type UseQueryOptions,
  type UseMutationOptions,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/query-core';
import { useAppStore } from '@template/ui/store';

export const useQuery = <
  TQueryFnData = unknown,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
): UseQueryResult<TData, TError> => {
  const client = useAppStore((state) => state.client);
  return tanstackUseQuery(options, client);
};

export const useMutation = <
  TData = unknown,
  TError = Error,
  TVariables = void,
  TContext = unknown,
>(
  options: UseMutationOptions<TData, TError, TVariables, TContext>,
): UseMutationResult<TData, TError, TVariables, TContext> => {
  const client = useAppStore((state) => state.client);
  return tanstackUseMutation(options, client);
};
