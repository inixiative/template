import { QueryClient } from '@tanstack/react-query';
import { client } from '@template/shared/apiClient';
import type { StateCreator } from 'zustand';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
});

export type ApiSlice = {
  api: {
    baseUrl: string;
    client: typeof client;
    queryClient: QueryClient;
    setBaseUrl: (url: string) => void;
    setAuthToken: (token: string | null) => void;
  };
};

export const createApiSlice: StateCreator<ApiSlice> = (set, get) => {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  client.setConfig({ baseUrl });

  return {
    api: {
      baseUrl,
      client,
      queryClient,

      setBaseUrl: (url) => {
        client.setConfig({ baseUrl: url });
        set((state) => ({
          api: { ...state.api, baseUrl: url },
        }));
      },

      setAuthToken: (token) => {
        const headers: Record<string, string> = {};

        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        client.setConfig({ headers });
      },
    },
  };
};

/**
 * Hook to access QueryClient from store
 *
 * @example
 * const queryClient = useQueryClient();
 * queryClient.invalidateQueries({ queryKey: ['organizations'] });
 */
export const useQueryClient = () => {
  return queryClient;
};
