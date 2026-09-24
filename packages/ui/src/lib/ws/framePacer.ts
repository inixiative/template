/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui, primitive:websockets
 * @uses none
 */
type Frame = Record<string, unknown>;

export type FramePacer = {
  enqueue: (frame: Frame, onSent?: () => void) => void;
  settle: () => void;
  cancel: (matches: (frame: Frame) => boolean) => void;
  clearQueued: () => void;
  reset: () => void;
};

export type FramePacerOptions = {
  send: (frame: Frame) => void;
  maxInFlight: number;
  maxPerWindow: number;
  windowMs: number;
};

export const createFramePacer = ({ send, maxInFlight, maxPerWindow, windowMs }: FramePacerOptions): FramePacer => {
  let queue: Array<{ frame: Frame; onSent?: () => void }> = [];
  let inFlight = 0;
  let sentAt: number[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;

  const pump = (): void => {
    clearTimeout(timer);
    timer = undefined;
    const now = Date.now();
    sentAt = sentAt.filter((at) => now - at < windowMs);
    while (queue.length && inFlight < maxInFlight && sentAt.length < maxPerWindow) {
      const next = queue.shift() as { frame: Frame; onSent?: () => void };
      inFlight++;
      sentAt.push(now);
      send(next.frame);
      next.onSent?.();
    }
    const oldest = sentAt[0];
    if (queue.length && inFlight < maxInFlight && oldest !== undefined) {
      timer = setTimeout(pump, windowMs - (now - oldest));
    }
  };

  return {
    enqueue: (frame, onSent) => {
      queue.push({ frame, onSent });
      pump();
    },
    settle: () => {
      inFlight = Math.max(0, inFlight - 1);
      pump();
    },
    cancel: (matches) => {
      queue = queue.filter(({ frame }) => !matches(frame));
    },
    clearQueued: () => {
      queue = [];
      clearTimeout(timer);
      timer = undefined;
    },
    reset: () => {
      queue = [];
      inFlight = 0;
      sentAt = [];
      clearTimeout(timer);
      timer = undefined;
    },
  };
};
