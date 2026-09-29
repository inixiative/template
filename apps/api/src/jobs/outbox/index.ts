// Durable overflow buffer in front of BullMQ. When queue depth crosses a cap an "overflow" flag
// flips and adhoc enqueues spill to the JobOutbox table instead of Redis; the per-worker drain loop
// (outbox/drain) meters them back in. See tickets/INFRA-021. Concerns split across this folder; this
// barrel is the public surface.

export {
  flushOutbox,
  hasPendingFastSpills,
  hasPendingSlowSpills,
  hasPendingSpills,
  spillToOutbox,
} from '#/jobs/outbox/accumulator';
export { laneDepthCap, lowWater, MAX_DRAIN_ATTEMPTS, maxQueueDepth, maxSlowQueueDepth } from '#/jobs/outbox/config';
export {
  clearOverflow,
  isLaneOverflowing,
  isOverflowing,
  renewOverflow,
  tripIfFull,
  warnIfOverflowStuck,
  withOverflowRenew,
} from '#/jobs/outbox/flag';
export { runOnOutboxQueue } from '#/jobs/outbox/mutex';
export { laneDepth, type QueueDepths, queueDepths } from '#/jobs/outbox/queueDepth';
export { type OutboxRow, outboxLaneOf, type SpillOptions, shouldSpill } from '#/jobs/outbox/types';
