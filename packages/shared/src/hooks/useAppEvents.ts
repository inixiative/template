import { useEffect, useState, useCallback, useRef } from 'react';

export type AppEventPayload = {
  type: string;
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
  data: Record<string, unknown>;
  timestamp: string;
};

type UseAppEventsOptions = {
  /** WebSocket URL (defaults to same origin with ws:// protocol) */
  url?: string;
  /** Bearer token for authentication (optional - anonymous if not provided) */
  token?: string;
  /** Channels to subscribe to on connect */
  channels?: string[];
  /** Called when an event is received */
  onEvent?: (event: AppEventPayload) => void;
  /** Called when connection opens */
  onOpen?: (connectionId: string) => void;
  /** Called when connection closes */
  onClose?: () => void;
  /** Reconnect automatically on disconnect */
  reconnect?: boolean;
  /** Reconnect delay in ms */
  reconnectDelay?: number;
};

type UseAppEventsReturn = {
  /** Whether WebSocket is connected */
  connected: boolean;
  /** Unique connection ID (for managing this specific connection) */
  connectionId: string | null;
  /** Recent events (newest first, max 50) */
  events: AppEventPayload[];
  /** Subscribe to a channel */
  subscribe: (channel: string) => void;
  /** Unsubscribe from a channel */
  unsubscribe: (channel: string) => void;
  /** Send a ping to keep connection alive */
  ping: () => void;
  /** Explicitly disconnect (clean shutdown, no auto-reconnect) */
  disconnect: () => void;
};

const MAX_EVENTS = 50;

export function useAppEvents(options: UseAppEventsOptions = {}): UseAppEventsReturn {
  const {
    url,
    token,
    channels = [],
    onEvent,
    onOpen,
    onClose,
    reconnect = true,
    reconnectDelay = 3000,
  } = options;

  const [connected, setConnected] = useState(false);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [events, setEvents] = useState<AppEventPayload[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const shouldReconnectRef = useRef(true); // Track if we should auto-reconnect

  // Get WebSocket URL with optional token
  const getWsUrl = useCallback(() => {
    let wsUrl = url;
    if (!wsUrl) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host}`;
    }
    // Add token as query param if provided
    if (token) {
      const separator = wsUrl.includes('?') ? '&' : '?';
      wsUrl = `${wsUrl}${separator}token=${encodeURIComponent(token)}`;
    }
    return wsUrl;
  }, [url, token]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(getWsUrl());

    ws.onopen = () => {
      setConnected(true);
      // connectionId will be set when we receive the 'connected' message
    };

    ws.onclose = () => {
      setConnected(false);
      setConnectionId(null);
      onClose?.();

      // Only reconnect if enabled AND not explicitly disconnected
      if (reconnect && shouldReconnectRef.current) {
        reconnectTimeoutRef.current = setTimeout(connect, reconnectDelay);
      }
    };

    ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);

        // Handle connection established - get our connectionId
        if (event.type === 'connected') {
          setConnectionId(event.connectionId);
          onOpen?.(event.connectionId);

          // Subscribe to initial channels after connection established
          for (const channel of channels) {
            ws.send(JSON.stringify({ action: 'subscribe', channel }));
          }
          return;
        }

        // Handle server-initiated reconnect (graceful shutdown)
        if (event.type === 'reconnect') {
          console.log('[WS] Server requested reconnect:', event.reason);
          ws.close();
          // Reconnect immediately (not waiting for delay) - but respect explicit disconnect
          if (shouldReconnectRef.current) {
            setTimeout(connect, 100);
          }
          return;
        }

        // Handle explicit disconnect confirmation
        if (event.type === 'disconnected') {
          console.log('[WS] Disconnected:', event.connectionId);
          return;
        }

        // Skip other system messages
        if (!event.type || event.type === 'subscribed' || event.type === 'unsubscribed' || event.type === 'pong') {
          return;
        }

        setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS));
        onEvent?.(event as AppEventPayload);
      } catch {
        // Ignore parse errors
      }
    };

    wsRef.current = ws;
  }, [getWsUrl, channels, onOpen, onClose, onEvent, reconnect, reconnectDelay]);

  // Subscribe to channel
  const subscribe = useCallback((channel: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'subscribe', channel }));
    }
  }, []);

  // Unsubscribe from channel
  const unsubscribe = useCallback((channel: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'unsubscribe', channel }));
    }
  }, []);

  // Send ping
  const ping = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'ping' }));
    }
  }, []);

  // Explicit disconnect (no auto-reconnect)
  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    clearTimeout(reconnectTimeoutRef.current);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // Send disconnect command to server for clean cleanup
      wsRef.current.send(JSON.stringify({ action: 'disconnect' }));
      // Actually close the connection
      wsRef.current.close();
    }
  }, []);

  // Connect on mount
  useEffect(() => {
    shouldReconnectRef.current = true; // Reset on mount
    connect();

    return () => {
      shouldReconnectRef.current = false;
      clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return {
    connected,
    connectionId,
    events,
    subscribe,
    unsubscribe,
    ping,
    disconnect,
  };
}
