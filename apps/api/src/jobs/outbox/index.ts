// Durable overflow buffer in front of BullMQ. When queue depth crosses a cap an "overflow" flag
// flips and adhoc enqueues spill to the JobOutbox table instead of Redis; the per-worker drain loop
// (outbox/drain) meters them back in. See tickets/INFRA-021. Concerns split across this folder; this
// barrel is the public surface.

export { flushOutbox, hasPendingFastSpills, hasPendingSpills, spillToOutbox } from '#/jobs/outbox/accumulator';
export { lowWater, MAX_DRAIN_ATTEMPTS, maxQueueDepth, maxSlowAdmissions } from '#/jobs/outbox/config';
export {
  clearOverflow,
  isOverflowing,
  renewOverflow,
  tripIfFull,
  warnIfOverflowStuck,
  withOverflowRenew,
} from '#/jobs/outbox/flag';
export { runOnOutboxQueue } from '#/jobs/outbox/mutex';
export { queueDepth } from '#/jobs/outbox/queueDepth';
export { type OutboxRow, outboxLaneOf, type SpillOptions, shouldSpill } from '#/jobs/outbox/types';
