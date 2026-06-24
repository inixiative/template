type HeartbeatOptions = { onError?: (err: unknown) => void };

// A self-managing timer loop: runs `beat` every `intervalMs`, scheduling each run only AFTER the
// previous one settles (recursive setTimeout, not setInterval) so an async beat slower than the
// interval can never overlap itself. Beat rejections go to `onError`, never unhandled. Returns a
// stop() that cancels the pending tick and prevents reschedule. No trailing beat on stop — a caller
// that needs a final action runs it after stop().
export const heartbeat = (
  beat: () => Promise<void> | void,
  intervalMs: number,
  { onError }: HeartbeatOptions = {},
): (() => void) => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const schedule = (): void => {
    timer = setTimeout(async () => {
      try {
        await beat();
      } catch (err) {
        onError?.(err);
      }
      if (!stopped) schedule();
    }, intervalMs);
  };

  schedule();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    timer = null;
  };
};
