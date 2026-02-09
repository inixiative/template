import type { QueryClient } from '@tanstack/react-query';
import type { client } from '@template/shared/apiClient';

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
