import { spyOn } from 'bun:test';

const CONNECTING = 0;
const OPEN = 1;
const CLOSING = 2;
const CLOSED = 3;

export class FakeBrowserWebSocket {
  static readonly CONNECTING = CONNECTING;
  static readonly OPEN = OPEN;
  static readonly CLOSING = CLOSING;
  static readonly CLOSED = CLOSED;
  readyState = CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  readonly sent: string[] = [];

  constructor(
    readonly url: string,
    private readonly closeDelayMs: number,
  ) {}

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    if (this.closeDelayMs <= 0) {
      this.finishClosing();
      return;
    }
    this.readyState = CLOSING;
    setTimeout(() => this.finishClosing(), this.closeDelayMs);
  }

  open(): void {
    this.readyState = OPEN;
    this.onopen?.();
  }

  receive(frame: unknown): void {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }

  sentFrames(): Array<Record<string, unknown>> {
    return this.sent.map((message) => JSON.parse(message));
  }

  private finishClosing(): void {
    this.readyState = CLOSED;
    this.onclose?.();
  }
}

export const installFakeBrowserWebSocket = ({
  closeDelayMs = 0,
}: {
  closeDelayMs?: number;
} = {}) => {
  const sockets: FakeBrowserWebSocket[] = [];
  const spy = spyOn(globalThis, 'WebSocket').mockImplementation(((url: string) => {
    const socket = new FakeBrowserWebSocket(url, closeDelayMs);
    sockets.push(socket);
    return socket;
  }) as never);
  Object.assign(spy, { CONNECTING, OPEN, CLOSING, CLOSED });
  return { sockets, restore: () => spy.mockRestore() };
};
