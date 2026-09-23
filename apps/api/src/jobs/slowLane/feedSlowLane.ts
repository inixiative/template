/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs
 * @uses infrastructure:prisma, infrastructure:redis
 */
import { LogScope, log } from '@template/shared/logger';
import { admitNextSlowOutboxRow, type SlowAdmission } from '#/jobs/slowLane/admitNextSlowOutboxRow';

const FEED_MAX_ROWS = 10;

export const feedSlowLane = async (admit = admitNextSlowOutboxRow): Promise<SlowAdmission> => {
  let result: SlowAdmission = 'empty';
  for (let row = 0; row < FEED_MAX_ROWS; row++) {
    result = await admit();
    if (result !== 'superseded') return result;
  }
  return result;
};

export const feedSlowLaneSafely = async (): Promise<void> => {
  try {
    await feedSlowLane();
  } catch (err) {
    log.error('Slow-lane feed failed; the drain will admit the next row', err, LogScope.job);
  }
};
