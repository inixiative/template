import type { StateCreator } from 'zustand';
import { QueryClient } from '@tanstack/react-query';
import { client } from '../../apiClient';

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
    spoofUserEmail: string | null;
    setBaseUrl: (url: string) => void;
    setAuthToken: (token: string | null) => void;
    setSpoofUserEmail: (email: string | null) => void;
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
      spoofUserEmail: null,

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

      setSpoofUserEmail: (email) => {
        const headers: Record<string, string> = {};

        if (email) {
          headers['spoof-user-email'] = email;
        }

        client.setConfig({ headers });
        set((state) => ({
          api: { ...state.api, spoofUserEmail: email },
        }));
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
export function useQueryClient() {
  return queryClient;
}
