import type { Context } from 'hono';
import { getValidatedBody } from '#/lib/context/getValidatedData';
import { allowFailures } from '#/modules/batch/services/strategies/allowFailures';
import { failOnRound } from '#/modules/batch/services/strategies/failOnRound';
import { transactionAll } from '#/modules/batch/services/strategies/transactionAll';
import { transactionPerRound } from '#/modules/batch/services/strategies/transactionPerRound';
import type { BatchRequest, BatchResult } from '#/modules/batch/services/strategies/types';
import type { AppEnv } from '#/types/appEnv';

export const batchExecutionStrategies = {
  transactionAll,
  transactionPerRound,
  allowFailures,
  failOnRound,
} as const;

export type BatchExecutionStrategy = keyof typeof batchExecutionStrategies;

const calculateTimeout = (totalRequests: number): number => {
  const baseTimeout = 10000;
  const perRequestTimeout = 2000;
  return baseTimeout + totalRequests * perRequestTimeout;
};

export const executeBatch = async (c: Context<AppEnv>): Promise<BatchResult> => {
  const {
    requests: rounds,
    strategy,
    headers: sharedHeaders = {},
  } = getValidatedBody<{
    requests: BatchRequest[][];
    strategy: string;
    headers?: Record<string, string>;
  }>(c);
  const totalRequests = rounds.reduce((sum: number, round: BatchRequest[]) => sum + round.length, 0);
  const timeout = calculateTimeout(totalRequests);

  const app = c.get('app');
  const baseRequest = c.req.raw;

  const executor = batchExecutionStrategies[strategy as keyof typeof batchExecutionStrategies];
  return await executor(app, rounds, sharedHeaders, baseRequest, c, timeout);
};
