type HeartbeatOptions = { onError?: (err: unknown) => void };

// A self-managing timer loop: runs `beat` every `intervalMs`, scheduling the next only after the
// previous settles (no overlap of a slow async beat), routing rejections to `onError`. Returns
// stop(); no trailing beat.
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
