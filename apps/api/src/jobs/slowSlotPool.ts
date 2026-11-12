/**
 * @atlas
 * @kind utils
 * @partOf primitive:jobs
 * @uses infrastructure:env
 */
import '#/config/env';

export type SlowSlotPool = {
  capacity: number;
  held: () => number;
  tryHold: () => boolean;
  release: () => void;
};

export const slowSlotCapacity = (concurrency: number): number =>
  Math.max(1, Math.floor(concurrency * process.env.JOBS_SLOW_SLOT_FRACTION));

export const createSlowSlotPool = (
  concurrency: number = process.env.JOBS_WORKER_CONCURRENCY,
): SlowSlotPool => {
  const capacity = slowSlotCapacity(concurrency);
  let held = 0;
  return {
    capacity,
    held: () => held,
    tryHold: () => {
      if (held >= capacity) return false;
      held++;
      return true;
    },
    release: () => {
      held = Math.max(0, held - 1);
    },
  };
};
