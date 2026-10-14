/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs
 * @uses infrastructure:redis
 */
import type { Job } from 'bullmq';
import type { JobData, JobsQueue } from '#/jobs/types';

const CHILD_PAGE = 1_000;

// A flow parent's children that have not reported yet. BullMQ lists them as job keys
// (`<prefix>:<queue>:<id>`), paged with a cursor; the id is the key without the queue's qualified
// name. A child removed from the queue meanwhile is skipped.
export const readUnfinishedChildren = async <TPayload>(
  jobsQueue: Pick<JobsQueue, 'getJob'>,
  parent: Job,
): Promise<Job<JobData<TPayload>>[]> => {
  const prefix = `${parent.queueQualifiedName}:`;
  const childIds: string[] = [];
  let cursor = 0;
  do {
    const page = await parent.getDependencies({ unprocessed: { cursor, count: CHILD_PAGE } });
    childIds.push(...(page.unprocessed ?? []).map((key) => key.slice(prefix.length)));
    cursor = page.nextUnprocessedCursor ?? 0;
  } while (cursor);
  const children = await Promise.all(childIds.map((id) => jobsQueue.getJob(id)));
  return children.filter((child): child is Job<JobData<TPayload>> => child !== undefined);
};
