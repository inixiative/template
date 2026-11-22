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

export const transactionAll: StrategyExecutor = async (
  app,
  rounds,
  sharedHeaders,
  baseRequest,
  baseContext,
  timeout,
) => {
  const batchId = Bun.randomUUIDv7();
  const totalRequests = rounds.reduce((sum, round) => sum + round.length, 0);
  const results: RequestResult[][] = [];
  let completedRounds = 0;
  let successfulRequests = 0;
  let failedRequests = 0;

  try {
    await db.txn(
      async () => {
        registerBatch(batchId, baseContext);

        try {
          for (let roundIndex = 0; roundIndex < rounds.length; roundIndex++) {
            const round = rounds[roundIndex];

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
            results.push(roundResults);

            const roundErrors = roundResults.filter((r) => r.error);
            if (roundErrors.length > 0) {
              failedRequests += roundErrors.length;
              throw new Error(`Request failed: ${roundErrors[0].error}`);
            }

            completedRounds++;

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

    successfulRequests = totalRequests;

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
    if (error instanceof HTTPException && error.status === 401) throw error;
    return {
      batch: results,
      summary: {
        totalRounds: rounds.length,
        completedRounds: 0,
        totalRequests,
        successfulRequests: 0,
        failedRequests,
        strategy: 'transactionAll',
        status: 'failed' as const,
      },
    };
  }
};
