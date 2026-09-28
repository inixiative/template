/**
 * @atlas
 * @kind hook
 * @partOf primitive:ui, primitive:websockets
 * @uses primitive:shared
 */
import { addStreamListener } from '@template/ui/lib/ws/streamListeners';
import { useAppStore } from '@template/ui/store';
import { useEffect, useRef } from 'react';

export const useStreamAction = <TPayload>(
  stream: string,
  type: string,
  listener: (payload: TPayload) => void,
): void => {
  const websocket = useAppStore((state) => state.websocket);
  const listenerRef = useRef(listener);
  listenerRef.current = listener;

  useEffect(() => {
    const removeListener = addStreamListener(stream, type, (payload) => listenerRef.current(payload as TPayload));
    websocket.open(stream);
    return () => {
      removeListener();
      websocket.close(stream);
    };
  }, [websocket, stream, type]);
};
