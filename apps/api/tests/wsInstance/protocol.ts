export const WS_INSTANCE_REPLY = '@@ws-instance ';

export type WSInstanceCommand =
  | { op: 'hold'; connectionId: string; stream: string; userId?: string }
  | { op: 'append'; stream: string; ids: string[]; userIds?: string[] }
  | { op: 'frames'; connectionId: string }
  | { op: 'dropSubscriber'; downMs: number }
  | { op: 'failAppends'; count: number };

export type WSInstanceReply =
  | { ready: true }
  | { id: number; result: unknown }
  | { id: number; error: string };
