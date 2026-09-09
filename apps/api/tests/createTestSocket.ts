import { createSerializedQueue } from '@template/shared/utils';
import type { WSData, WSSocket } from '#/ws/types';

// A real recorder object shaped like a ServerWebSocket — NOT a spyOn mock. Bun
// sockets can't be instantiated without a live server, so registry/delivery
// tests store this and read `sent` / `closeInfo`. Real-socket behavior is
// covered by handler/upgrade integration tests, not here.

const WS_OPEN = 1;
const WS_CLOSED = 3;

let seq = 0;

export type TestSocketHandle = {
  socket: WSSocket;
  sent: string[];
  markClosed: () => void;
  closeInfo: () => { code: number; reason: string } | null;
};

export const createTestSocket = (data?: Partial<WSData>): TestSocketHandle => {
  const now = Date.now();
  const sent: string[] = [];
  let readyState = WS_OPEN;
  let closeInfo: { code: number; reason: string } | null = null;

  const socket = {
    data: {
      connectionId: data?.connectionId ?? `conn-${++seq}`,
      userId: data?.userId ?? null,
      headers: data?.headers ?? {},
      channels: data?.channels ?? new Set<string>(),
      connectedAt: data?.connectedAt ?? now,
      lastPing: data?.lastPing ?? now,
      queue: data?.queue ?? createSerializedQueue(),
    } satisfies WSData,
    get readyState() {
      return readyState;
    },
    send(message: string) {
      sent.push(message);
    },
    close(code: number, reason: string) {
      readyState = WS_CLOSED;
      closeInfo = { code, reason };
    },
  } as unknown as WSSocket;

  return {
    socket,
    sent,
    markClosed: () => {
      readyState = WS_CLOSED;
    },
    closeInfo: () => closeInfo,
  };
};
