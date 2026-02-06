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
  const { requests: rounds, strategy, headers: sharedHeaders = {} } = c.req.valid('json');
  const totalRequests = rounds.reduce((sum, round) => sum + round.length, 0);
  const timeout = calculateTimeout(totalRequests);

  const app = c.get('app');
  const baseRequest = c.req.raw;

  const executor = batchExecutionStrategies[strategy];
  return await executor(app, rounds, sharedHeaders, baseRequest, c, timeout);
};
