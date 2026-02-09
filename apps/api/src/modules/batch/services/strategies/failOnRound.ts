import { db } from '@template/db';
import { refreshBatchContext, registerBatch, unregisterBatch } from '#/modules/batch/services/batchRegistry';
import { interpolateRequest } from '#/modules/batch/services/interpolation';
import { executeRequest } from '#/modules/batch/services/strategies/executeRequest';
import type { StrategyExecutor } from '#/modules/batch/services/strategies/types';

export const failOnRound: StrategyExecutor = async (app, rounds, sharedHeaders, baseRequest, baseContext, timeout) => {
  const batchId = crypto.randomUUID();
  registerBatch(batchId, db as any, baseContext);

  const results: any[][] = [];
  const totalRequests = rounds.reduce((sum, round) => sum + round.length, 0);
  let completedRounds = 0;
  let successfulRequests = 0;
  let failedRequests = 0;

  try {
    for (let roundIndex = 0; roundIndex < rounds.length; roundIndex++) {
      const round = rounds[roundIndex];

      const roundPromises = round.map(async (request) => {
        try {
          const interpolatedRequest = interpolateRequest(request, { results, currentRound: roundIndex });
          const result = await executeRequest(app, interpolatedRequest, batchId, sharedHeaders, baseRequest);
          if (result.error) {
            failedRequests++;
          } else {
            successfulRequests++;
          }
          return result;
        } catch (error) {
          failedRequests++;
          return {
            status: 500,
            body: null,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      });

      const roundResults = await Promise.all(roundPromises);
      results.push(roundResults);
      completedRounds++;

      const hasFailures = roundResults.some((r) => r.error);
      if (hasFailures) {
        break;
      }

      if (roundIndex < rounds.length - 1) {
        await refreshBatchContext(batchId);
      }
    }

    const status = failedRequests === 0 ? 'success' : failedRequests === totalRequests ? 'failed' : 'partialSuccess';

    return {
      batch: results,
      summary: {
        totalRounds: rounds.length,
        completedRounds,
        totalRequests,
        successfulRequests,
        failedRequests,
        strategy: 'failOnRound',
        status,
      },
    };
  } finally {
    unregisterBatch(batchId);
  }
};
