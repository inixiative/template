import type {
  UseQueryOptions,
  UseMutationOptions,
  UseQueryResult,
  UseMutationResult,
} from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/query-core';
import { useQuery, useMutation } from './useQuery';
import { useAppStore } from '../store';

export type ApiQueryOptions<
  TQueryFnData = unknown,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> = Omit<UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>, 'queryFn'> & {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: HeadersInit;
};

export type ApiMutationOptions<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TContext = unknown,
> = Omit<UseMutationOptions<TData, TError, TVariables, TContext>, 'mutationFn'> & {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: HeadersInit;
};

/**
 * Converts HeadersInit to Record<string, string>
 */
const normalizeHeaders = (headers?: HeadersInit): Record<string, string> => {
  if (!headers) return {};

  // Handle Headers object
  if (headers instanceof Headers) {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  // Handle array of tuples
  if (Array.isArray(headers)) {
    const result: Record<string, string> = {};
    for (const [key, value] of headers) {
      result[key] = value;
    }
    return result;
  }

  // Handle plain object
  return headers as Record<string, string>;
};

/**
 * Builds headers with auto-injected auth token and spoof user email
 */
const useApiHeaders = (customHeaders?: HeadersInit): Record<string, string> => {
  const token = useAppStore((state) => state.auth.session?.accessToken);
  const spoofUserEmail = useAppStore((state) => state.auth.spoofUserEmail);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...normalizeHeaders(customHeaders),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (spoofUserEmail) {
    headers['x-spoof-user-email'] = spoofUserEmail;
  }

  return headers;
};

/**
 * Custom useQuery for internal API calls
 * Automatically injects auth token and spoof context headers
 */
export const useApiQuery = <
  TQueryFnData = unknown,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: ApiQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
): UseQueryResult<TData, TError> => {
  const { url, method = 'GET', body, headers: customHeaders, ...queryOptions } = options;
  const headers = useApiHeaders(customHeaders);

  return useQuery({
    ...queryOptions,
    queryFn: async () => {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      return response.json();
    },
  });
};

/**
 * Custom useMutation for internal API calls
 * Automatically injects auth token and spoof context headers
 */
export const useApiMutation = <
  TData = unknown,
  TError = Error,
  TVariables = void,
  TContext = unknown,
>(
  options: ApiMutationOptions<TData, TError, TVariables, TContext>,
): UseMutationResult<TData, TError, TVariables, TContext> => {
  const { url, method = 'POST', headers: customHeaders, ...mutationOptions } = options;
  const headers = useApiHeaders(customHeaders);

  return useMutation({
    ...mutationOptions,
    mutationFn: async (variables: TVariables) => {
      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(variables),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      return response.json();
    },
  });
};
