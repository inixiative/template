import { channelKey, LIVE_QUERIES } from '@template/shared/ws';
import { createApiWebsocket } from '@template/ui/lib/ws/createApiWebsocket';
import type { AppStore } from '@template/ui/store/types';
import type { ClientSlice } from '@template/ui/store/types/client';
import type { StateCreator } from 'zustand';

export const createClientSlice: StateCreator<AppStore, [], [], ClientSlice> = (set, get) => {
  // API websocket — derive ws(s):// from the http(s) API url. Connect happens on app load via
  // useApiWebsocket; identity sends are driven by the auth slice.
  const wsUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/^http/, 'ws');

  // The channel a query subscribes to, or null if it isn't a registered live query.
  const liveChannel = (queryKey: readonly unknown[]): string | null => {
    const key = queryKey[0] as { _id?: string; path?: Record<string, unknown> };
    const id = key?._id;
    if (!id || !LIVE_QUERIES.has(id)) return null;
    return channelKey({ _id: id, path: key.path });
  };

  return {
    client: null, // set at the app root via setClient (see main.tsx)
    // On reconnect, refetch live queries to recover any invalidations missed while disconnected.
    websocket: createApiWebsocket(wsUrl, () => {
      get().client?.invalidateQueries({ predicate: (query) => liveChannel(query.queryKey) !== null });
    }),

    setClient: (client) => {
      set({ client });
      // Pipe live queries to channel subscriptions; the websocket owns the channels + replay.
      client.getQueryCache().subscribe((event) => {
        const channel = liveChannel(event.query.queryKey);
        if (!channel) return;
        if (event.type === 'observerAdded') get().websocket.subscribe(channel);
        else if (event.type === 'observerRemoved') get().websocket.unsubscribe(channel);
      });
    },
  };
};
