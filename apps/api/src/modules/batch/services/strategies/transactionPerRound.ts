/**
 * @atlas
 * @kind service
 * @partOf primitive:batch
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import { HTTPException } from 'hono/http-exception';
import {
  refreshBatchContext,
  registerBatch,
  unregisterBatch,
} from '#/modules/batch/services/batchRegistry';
import { interpolateBatchableRequest } from '#/modules/batch/services/interpolation';
import { executeRequest } from '#/modules/batch/services/strategies/executeRequest';
import type { RequestResult, StrategyExecutor } from '#/modules/batch/services/strategies/types';

export const transactionPerRound: StrategyExecutor = async (
  app,
  rounds,
  sharedHeaders,
  baseRequest,
  baseContext,
  timeout,
) => {
  const results: RequestResult[][] = [];
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
          const batchId = Bun.randomUUIDv7();
          registerBatch(batchId, baseContext);

          try {
            const roundPromises = round.map(async (request): Promise<RequestResult> => {
              try {
                const interpolatedRequest = interpolateBatchableRequest(app, request, {
                  results,
                  currentRound: roundIndex,
                });
                return await executeRequest(
                  app,
                  interpolatedRequest,
                  batchId,
                  sharedHeaders,
                  baseRequest,
                );
              } catch (error) {
                return {
                  status: 500,
                  body: null,
                  error: error instanceof Error ? error.message : 'Unknown error',
                };
              }
            });

            const roundResults = await Promise.all(roundPromises);

            const roundErrors = roundResults.filter((r) => r.error);
            if (roundErrors.length > 0) {
              failedRequests += roundErrors.length;
              results.push(roundResults);
              throw new Error(`Request failed: ${roundErrors[0].error}`);
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
      successfulRequests += roundResult.length;

      if (roundIndex < rounds.length - 1) {
        const batchId = Bun.randomUUIDv7();
        registerBatch(batchId, baseContext);
        try {
          await refreshBatchContext(batchId);
        } finally {
          unregisterBatch(batchId);
        }
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
    if (error instanceof HTTPException && error.status === 401) throw error;
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
