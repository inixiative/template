/**
 * @atlas
 * @kind utils
 * @partOf primitive:jobs
 * @uses infrastructure:redis
 */
import { LogScope, log } from '@template/shared/logger';

export const resolveBullmqRedisUrl = (): string | undefined => {
  if (process.env.REDIS_BULLMQ_URL) return process.env.REDIS_BULLMQ_URL;

  if (process.env.REDIS_URL) {
    log.warn(
      'REDIS_BULLMQ_URL is unset — BullMQ is sharing REDIS_URL, whose eviction policy can drop job locks and completed-job records',
      LogScope.job,
    );
  }

  return process.env.REDIS_URL;
};
