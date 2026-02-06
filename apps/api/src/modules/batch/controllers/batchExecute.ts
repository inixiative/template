import { HTTPException } from 'hono/http-exception';
import { makeController } from '#/lib/utils/makeController';
import { batchExecuteRoute } from '#/modules/batch/routes/batchExecute';
import { executeBatch } from '#/modules/batch/services/executor';

export const batchExecuteController = makeController(batchExecuteRoute, async (c, respond) => {
  const batchId = c.req.header('X-Batch-Id');
  if (batchId) throw new HTTPException(400, { message: 'Batch requests cannot be nested' });

  const body = c.req.valid('json');

  // Validate request limits (moved from route .refine() for OpenAPI compatibility)
  const maxPerRound = body.requests.reduce((max, round) => Math.max(max, round.length), 0);
  if (maxPerRound > 50) {
    throw new HTTPException(400, { message: 'Maximum 50 requests per round' });
  }

  const totalRequests = body.requests.reduce((sum, round) => sum + round.length, 0);
  if (totalRequests > 100) {
    throw new HTTPException(400, { message: 'Maximum 100 total requests' });
  }

  const { batch, summary } = await executeBatch(c);

  return respond.ok({ batch, summary });
});
