import {
  useQuery as tanstackUseQuery,
  useMutation as tanstackUseMutation,
  type UseQueryOptions,
  type UseMutationOptions,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/query-core';
import { useAppStore } from '../store';

/**
 * Custom useQuery that gets QueryClient from Zustand instead of React Context
 * Use for external API calls (no auth headers injected)
 */
export const useQuery = <
  TQueryFnData = unknown,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
): UseQueryResult<TData, TError> => {
  const queryClient = useAppStore((state) => state.api.queryClient);
  return tanstackUseQuery(options, queryClient);
};

/**
 * Custom useMutation that gets QueryClient from Zustand instead of React Context
 * Use for external API calls (no auth headers injected)
 */
export const useMutation = <
  TData = unknown,
  TError = Error,
  TVariables = void,
  TContext = unknown,
>(
  options: UseMutationOptions<TData, TError, TVariables, TContext>,
): UseMutationResult<TData, TError, TVariables, TContext> => {
  const queryClient = useAppStore((state) => state.api.queryClient);
  return tanstackUseMutation(options, queryClient);
};
