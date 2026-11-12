/**
 * @atlas
 * @kind constructor, service
 * @partOf primitive:jobs
 * @uses none
 */
import { spreadDelays } from '#/jobs/spreadDelays';
import type { EnqueueChildJob, EnqueueChildJobs } from '#/jobs/types';

// The `enqueueChildJobs` a stage receives: one child per payload through `enqueueChildJob`. With
// `spreadSeconds` their starts are spaced evenly across that window instead of all at once, so a
// fan-out over every tenant doesn't land as one burst of queries. The first child always starts
// immediately. Spacing is a BullMQ `delay` on each child, so the parent still waits for every child.
// In an inline test run a delayed child returns unrun (see enqueueJob).
export const makeEnqueueChildJobs =
  (enqueueChildJob: EnqueueChildJob): EnqueueChildJobs =>
  async (handlerName, payloads, { spreadSeconds = 0 } = {}) => {
    const delays = spreadDelays(payloads.length, spreadSeconds * 1000);
    for (const [index, payload] of payloads.entries()) {
      await enqueueChildJob(handlerName, payload, { delay: delays[index] });
    }
  };
