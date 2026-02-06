import { db } from '@template/db';
import { interpolateRequest } from '#/modules/batch/services/interpolation';
import { registerBatch, refreshBatchContext, unregisterBatch } from '#/modules/batch/services/batchRegistry';
import { executeRequest } from './executeRequest';
import type { StrategyExecutor } from './types';

export const transactionAll: StrategyExecutor = async (
  app,
  rounds,
  sharedHeaders,
  baseRequest,
  baseContext,
  timeout,
) => {
  const batchId = crypto.randomUUID();
  const totalRequests = rounds.reduce((sum, round) => sum + round.length, 0);
  const results: any[][] = [];
  let completedRounds = 0;
  let successfulRequests = 0;
  let failedRequests = 0;

  try {
    await db.txn(
      async () => {
        registerBatch(batchId, db as any, baseContext);

        try {
          for (let roundIndex = 0; roundIndex < rounds.length; roundIndex++) {
            const round = rounds[roundIndex];

            const roundPromises = round.map(async (request) => {
              const interpolatedRequest = interpolateRequest(request, { results, currentRound: roundIndex });
              return await executeRequest(app, interpolatedRequest, batchId, sharedHeaders, baseRequest);
            });

            const roundResults = await Promise.all(roundPromises);
            results.push(roundResults);
            completedRounds++;

            for (const result of roundResults) {
              if (result.error) {
                failedRequests++;
                throw new Error(`Request failed: ${result.error}`);
              }
              successfulRequests++;
            }

            if (roundIndex < rounds.length - 1) {
              await refreshBatchContext(batchId);
            }
          }
        } finally {
          unregisterBatch(batchId);
        }
      },
      { timeout },
    );

    return {
      batch: results,
      summary: {
        totalRounds: rounds.length,
        completedRounds,
        totalRequests,
        successfulRequests,
        failedRequests,
        strategy: 'transactionAll',
        status: 'success' as const,
      },
    };
  } catch (error) {
    return {
      batch: results,
      summary: {
        totalRounds: rounds.length,
        completedRounds,
        totalRequests,
        successfulRequests,
        failedRequests,
        strategy: 'transactionAll',
        status: 'failed' as const,
      },
    };
  }
};
