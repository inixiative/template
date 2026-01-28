import { enqueueJob } from '#/jobs/enqueue';
import type { JobPayloads } from '#/jobs/handlers';
import { makeController } from '#/lib/utils/makeController';
import { jobEnqueueRoute } from '#/modules/admin/job/routes/jobEnqueue';

export const jobEnqueueController = makeController(jobEnqueueRoute, async (c, respond) => {
  const { handler, payload, options } = c.req.valid('json');

  const result = await enqueueJob(handler as keyof JobPayloads, (payload ?? {}) as never, options);

  return respond.created({
    jobId: result.jobId ?? null,
    name: result.name,
    enqueuedAt: new Date().toISOString(),
  });
});
