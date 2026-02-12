import type { QueryFunctionContext } from '@tanstack/react-query';
import { createClient, type Client } from '@template/ui/apiClient/client';
import { getToken } from '@template/ui/lib/auth/token';

/**
 * Extracts the success type from SDK union types
 * When throwOnError is true, the error case never happens (it throws instead)
 * So we extract only the success variant from: { data: X } | { error: Y }
 */
export type ExtractSuccess<T> = T extends { data: infer D; error?: never }
  ? T
  : T extends { data: any } | { error: any }
    ? Extract<T, { data: any }>
    : T;

/**
 * Unwraps nested API response types at compile time
 * { data: { data: X, pagination: Y } } -> { data: X, pagination: Y }
 */
type UnwrapResponse<T> = ExtractSuccess<T> extends { data: infer DataObj }
  ? DataObj extends { data: infer InnerData }
    ? Omit<ExtractSuccess<T>, 'data'> & { data: InnerData } & (DataObj extends { pagination: infer P } ? { pagination: P } : unknown)
    : ExtractSuccess<T>
  : ExtractSuccess<T>;

/**
 * Overloaded return type for apiFetch that works with both queries and mutations
 */
interface ApiFetchFunction<T, TVariables> {
  // For React Query queries
  (context: QueryFunctionContext): Promise<UnwrapResponse<T>>;
  // For mutations with variables
  (vars: TVariables): Promise<UnwrapResponse<T>>;
  // For queries/mutations without variables
  (): Promise<UnwrapResponse<T>>;
}

export type ClientInjectedOptions = {
  client?: Client;
  throwOnError?: boolean;
};

export type RequestOptionsFor<TVariables extends Record<string, unknown> | void> =
  TVariables extends void ? ClientInjectedOptions : TVariables & ClientInjectedOptions;

/**
 * Internal API fetch function that doesn't depend on the store.
 * Use this directly when you need to avoid circular dependencies.
 *
 * Handles both React Query context and direct variables:
 * - QueryFunctionContext: Extracts variables from queryKey[1]
 * - Direct vars: Uses them as-is
 */
export const apiFetchInternal = <T, TVariables extends Record<string, unknown> | void = void>(
  fn: (requestOptions: RequestOptionsFor<TVariables>) => Promise<T>,
  options?: {
    token?: string | null;
    spoofUserEmail?: string | null;
  }
): ApiFetchFunction<T, TVariables> => {
  const implementation = async (contextOrVars?: QueryFunctionContext | TVariables): Promise<UnwrapResponse<T>> => {
    const headers: Record<string, string> = {};

    headers['Content-Type'] ??= 'application/json';

    const token = options?.token ?? getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (options?.spoofUserEmail) headers['x-spoof-user-email'] = options.spoofUserEmail;

    const scopedClient = createClient({
      baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:8000',
      headers,
      throwOnError: true,
    });

    // Detect React Query context and extract variables from queryKey
    const isQueryContext = (contextOrVars as QueryFunctionContext)?.queryKey !== undefined;
    const vars = (
      isQueryContext
        ? (contextOrVars as QueryFunctionContext).queryKey[1]
        : contextOrVars
    ) as TVariables | undefined;

    const mergedOptions = {
      ...((vars ?? {}) as Record<string, unknown>),
      client: scopedClient,
      throwOnError: true,
    } as RequestOptionsFor<TVariables>;

    const result = await fn(mergedOptions);

    // Runtime check: ensure we have a success response (no error field)
    // With throwOnError: true, this should never happen, but we check to help TypeScript
    // and ensure errors are properly thrown for the toast handler
    if (result && typeof result === 'object' && 'error' in result && result.error !== undefined) {
      throw result.error;
    }

    // Unwrap nested API response: { data: { data, pagination } } -> { data, pagination }
    if (result && typeof result === 'object' && 'data' in result) {
      const apiResult = result as { data?: { data?: unknown; [key: string]: unknown }; [key: string]: unknown };
      if (apiResult.data && typeof apiResult.data === 'object' && 'data' in apiResult.data) {
        const { data: innerData, ...otherKeys } = apiResult.data;
        return {
          ...apiResult,
          data: innerData,
          ...otherKeys,
        } as UnwrapResponse<T>;
      }
    }

    return result as UnwrapResponse<T>;
  };

  return implementation as ApiFetchFunction<T, TVariables>;
};
