/**
 * @atlas
 * @kind utils
 * @partOf primitive:lifecycle
 * @uses none
 */

type UnrefInterval = {
  /** Idempotent — a second call while running is a no-op, so two tickers can't stack. */
  start: () => void;
  stop: () => void;
  isRunning: () => boolean;
};

/**
 * A background ticker that never keeps the process alive.
 *
 * Every recurring in-process loop wants the same three properties — start once, stop cleanly,
 * and `unref` so a pending tick can't hold a shutdown open — and each hand-rolled copy has to
 * remember all three. The tick body is the caller's; the bookkeeping lives here.
 */
export const makeUnrefInterval = ({ intervalMs, tick }: { intervalMs: number; tick: () => void }): UnrefInterval => {
  let timer: ReturnType<typeof setInterval> | null = null;

  return {
    start: () => {
      if (timer) return;
      timer = setInterval(tick, intervalMs);
      timer.unref?.();
    },
    stop: () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    },
    isRunning: () => timer !== null,
  };
};
