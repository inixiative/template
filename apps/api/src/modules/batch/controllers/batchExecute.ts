/**
 * @atlas
 * @kind controller
 * @partOf primitive:batch
 * @uses primitive:routeTemplates
 */
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { batchExecuteRoute } from '#/modules/batch/routes/batchExecute';
import { executeBatch } from '#/modules/batch/services/executor';

export const batchExecuteController = makeController(batchExecuteRoute, async (c, respond) => {
  const batchId = c.req.header('x-batch-id');
  if (batchId) throw makeError({ status: 400, message: 'Batch requests cannot be nested' });

  const { batch, summary } = await executeBatch(c);

  return respond.ok({ batch, summary });
});
