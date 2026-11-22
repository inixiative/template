/**
 * @atlas
 * @kind type, client, store
 * @partOf primitive:ui
 * @uses none
 */
import type { QueryClient } from '@tanstack/react-query';
import type { ApiWebsocket } from '@template/ui/lib/ws/createApiWebsocket';

export type QueryClientAndWebsocketSlice = {
  queryClient: QueryClient | null;
  websocket: ApiWebsocket;
  connectQueryClientToWebsocket: (queryClient: QueryClient) => void;
};
