import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { batchExecuteRoute } from '#/modules/batch/routes/batchExecute';
import { executeBatch } from '#/modules/batch/services/executor';

export const batchExecuteController = makeController(batchExecuteRoute, async (c, respond) => {
  const batchId = c.req.header('x-batch-id');
  if (batchId) throw makeError({ status: 400, message: 'Batch requests cannot be nested', requestId: c.get('requestId') });

  const body = c.req.valid('json');

  // Validate request limits (moved from route .refine() for OpenAPI compatibility)
  const maxPerRound = body.requests.reduce((max, round) => Math.max(max, round.length), 0);
  if (maxPerRound > 50) {
    throw makeError({ status: 400, message: 'Maximum 50 requests per round', requestId: c.get('requestId') });
  }

  const totalRequests = body.requests.reduce((sum, round) => sum + round.length, 0);
  if (totalRequests > 100) {
    throw makeError({ status: 400, message: 'Maximum 100 total requests', requestId: c.get('requestId') });
  }

  const { batch, summary } = await executeBatch(c);

  return respond.ok({ batch, summary });
});
