/**
 * @atlas
 * @kind hook
 * @partOf primitive:ui
 * @uses none
 */
import type { QueryKey } from '@tanstack/react-query';
import {
  useMutation as tanstackUseMutation,
  useQuery as tanstackUseQuery,
  type UseMutationOptions,
  type UseMutationResult,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';

export const useQuery = <
  TQueryFnData = unknown,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
): UseQueryResult<TData, TError> => {
  return tanstackUseQuery(options);
};

export const useMutation = <TData = unknown, TError = Error, TVariables = void, TContext = unknown>(
  options: UseMutationOptions<TData, TError, TVariables, TContext>,
): UseMutationResult<TData, TError, TVariables, TContext> => {
  return tanstackUseMutation(options);
};
