import { db } from '@template/db';
import { interpolateRequest } from '#/modules/batch/services/interpolation';
import { registerBatch, refreshBatchContext, unregisterBatch } from '#/modules/batch/services/batchRegistry';
import { executeRequest } from './executeRequest';
import type { StrategyExecutor } from './types';

export const transactionPerRound: StrategyExecutor = async (
  app,
  rounds,
  sharedHeaders,
  baseRequest,
  baseContext,
  timeout,
) => {
  const results: any[][] = [];
  const totalRequests = rounds.reduce((sum, round) => sum + round.length, 0);
  const timeoutPerRound = Math.ceil(timeout / rounds.length);
  let completedRounds = 0;
  let successfulRequests = 0;
  let failedRequests = 0;

  try {
    for (let roundIndex = 0; roundIndex < rounds.length; roundIndex++) {
      const round = rounds[roundIndex];

      const roundResult = await db.txn(
        async () => {
          const batchId = crypto.randomUUID();
          registerBatch(batchId, db as any, baseContext);

          try {
            const roundPromises = round.map(async (request) => {
              const interpolatedRequest = interpolateRequest(request, { results, currentRound: roundIndex });
              return await executeRequest(app, interpolatedRequest, batchId, sharedHeaders, baseRequest);
            });

            const roundResults = await Promise.all(roundPromises);

            for (const result of roundResults) {
              if (result.error) {
                failedRequests++;
                throw new Error(`Request failed: ${result.error}`);
              }
              successfulRequests++;
            }

            return roundResults;
          } finally {
            unregisterBatch(batchId);
          }
        },
        { timeout: timeoutPerRound },
      );

      results.push(roundResult);
      completedRounds++;

      if (roundIndex < rounds.length - 1) {
        const batchId = crypto.randomUUID();
        registerBatch(batchId, db as any, baseContext);
        await refreshBatchContext(batchId);
        unregisterBatch(batchId);
      }
    }

    return {
      batch: results,
      summary: {
        totalRounds: rounds.length,
        completedRounds,
        totalRequests,
        successfulRequests,
        failedRequests,
        strategy: 'transactionPerRound',
        status: 'success' as const,
      },
    };
  } catch (error) {
    const status = completedRounds === 0 ? 'failed' : 'partialSuccess';
    return {
      batch: results,
      summary: {
        totalRounds: rounds.length,
        completedRounds,
        totalRequests,
        successfulRequests,
        failedRequests,
        strategy: 'transactionPerRound',
        status,
      },
    };
  }
};
