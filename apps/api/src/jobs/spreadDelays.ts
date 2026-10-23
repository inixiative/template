/**
 * @atlas
 * @kind helper
 * @partOf primitive:jobs
 * @uses none
 */

// Start offsets, in ms, for `count` children spread evenly across `spreadMs`: child `i` starts at
// `i * spreadMs / count`, so the last one starts one step before the window closes, not at its end.
export const spreadDelays = (count: number, spreadMs: number): number[] =>
  Array.from({ length: count }, (_, index) =>
    count > 1 ? Math.round((index * spreadMs) / count) : 0,
  );
