/**
 * @atlas
 * @kind hook
 * @partOf primitive:ui, primitive:websockets
 * @uses primitive:shared
 */
import type { StreamActionPayload, StreamActionType, StreamDefinition, StreamParams } from '@template/shared/ws';
import { addStreamListener } from '@template/ui/lib/ws/streamListeners';
import { useAppStore } from '@template/ui/store';
import { useEffect, useRef } from 'react';

export const useStreamAction = <D extends StreamDefinition, K extends StreamActionType<D>>(
  definition: D,
  params: StreamParams<D>,
  type: K,
  listener: (payload: StreamActionPayload<D, K>) => void,
): void => {
  const stream = definition.name(params);
  const websocket = useAppStore((state) => state.websocket);
  const listenerRef = useRef(listener);
  listenerRef.current = listener;

  useEffect(() => {
    const removeListener = addStreamListener(stream, type, (payload) =>
      listenerRef.current(payload as StreamActionPayload<D, K>),
    );
    websocket.open(stream);
    return () => {
      removeListener();
      websocket.close(stream);
    };
  }, [websocket, stream, type]);
};
