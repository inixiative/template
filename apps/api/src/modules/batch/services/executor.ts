import type { Hono } from 'hono';
import type { Context } from 'hono';
import type { AppEnv } from '#/types/appEnv';
import { transactionAll } from './strategies/transactionAll';
import { transactionPerRound } from './strategies/transactionPerRound';
import { allowFailures } from './strategies/allowFailures';
import { failOnRound } from './strategies/failOnRound';
import type { BatchRequest, BatchResult } from './strategies/types';

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
  return baseTimeout + (totalRequests * perRequestTimeout);
};

export const executeBatch = async (c: Context<AppEnv>): Promise<BatchResult> => {
  const { requests: rounds, strategy, headers: sharedHeaders = {} } = (c.req as unknown as { valid: (key: string) => unknown }).valid('json') as { requests: BatchRequest[][]; strategy: string; headers?: Record<string, string> };
  const totalRequests = rounds.reduce((sum: number, round: BatchRequest[]) => sum + round.length, 0);
  const timeout = calculateTimeout(totalRequests);

  const app = c.get('app');
  const baseRequest = c.req.raw;

  const executor = batchExecutionStrategies[strategy as keyof typeof batchExecutionStrategies];
  return await executor(app, rounds, sharedHeaders, baseRequest, c, timeout);
};
