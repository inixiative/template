// Generic browser WebSocket client — transport only. Owns the socket lifecycle
// (connect, auto-reconnect), queues sends until open, and forwards parsed inbound
// frames to a single onMessage callback. Knows nothing about the API protocol.

export type WSStatus = 'closed' | 'connecting' | 'open';

export type WebSocketClientOptions = {
  url: string;
  onMessage?: (data: unknown) => void;
  onOpen?: () => void;
  onClose?: () => void;
  reconnectDelayMs?: number;
};

export type WebSocketClient = {
  connect: () => void;
  close: () => void;
  reconnect: () => void;
  send: (data: unknown) => void;
  status: () => WSStatus;
};

export const createWebSocketClient = ({
  url,
  onMessage,
  onOpen,
  onClose,
  reconnectDelayMs = 3000,
}: WebSocketClientOptions): WebSocketClient => {
  let ws: WebSocket | null = null;
  let shouldReconnect = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const queue: string[] = [];

  const flush = (): void => {
    while (queue.length && ws?.readyState === WebSocket.OPEN) ws.send(queue.shift() as string);
  };

  const connect = (): void => {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
    shouldReconnect = true;
    ws = new WebSocket(url);
    ws.onopen = () => {
      flush();
      onOpen?.();
    };
    // Inbound from our own server — always valid JSON text.
    ws.onmessage = (e) => onMessage?.(JSON.parse(e.data));
    ws.onclose = () => {
      onClose?.();
      if (shouldReconnect) timer = setTimeout(connect, reconnectDelayMs);
    };
  };

  const close = (): void => {
    shouldReconnect = false;
    clearTimeout(timer);
    ws?.close();
  };

  // Drop the current socket but keep auto-reconnect — used to recover a half-open connection.
  const reconnect = (): void => {
    ws?.close();
  };

  const send = (data: unknown): void => {
    const message = JSON.stringify(data);
    if (ws?.readyState === WebSocket.OPEN) ws.send(message);
    else queue.push(message); // flushed on open
  };

  const status = (): WSStatus => {
    if (ws?.readyState === WebSocket.OPEN) return 'open';
    if (ws?.readyState === WebSocket.CONNECTING) return 'connecting';
    return 'closed';
  };

  return { connect, close, reconnect, send, status };
};
