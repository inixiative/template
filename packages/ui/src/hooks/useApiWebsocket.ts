/**
 * @atlas
 * @kind hook
 * @partOf primitive:ui
 * @uses none
 */
import { useAppStore } from '@template/ui/store';
import { useEffect } from 'react';

// Connects the API websocket on app load. Inbound events (query.refetch → invalidation) are wired
// into the socket at creation; identity (authenticate / spoof / logout) is driven by the auth
// slice. Mount once at the app root.
export const useApiWebsocket = (): void => {
  const connect = useAppStore((state) => state.websocket.connect);
  useEffect(() => {
    connect();
  }, [connect]);
};
