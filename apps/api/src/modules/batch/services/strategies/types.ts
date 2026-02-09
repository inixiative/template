import type { Context, Hono } from 'hono';
import type { AppEnv } from '#/types/appEnv';

export type BatchRequest = {
  method: string;
  path: string;
  body?: any;
  headers?: Record<string, string>;
};

export type RequestResult = {
  status: number;
  body: any;
  error?: string;
};

export type BatchSummary = {
  totalRounds: number;
  completedRounds: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  strategy: string;
  status: 'success' | 'partialSuccess' | 'failed';
};

export type BatchResult = {
  batch: RequestResult[][];
  summary: BatchSummary;
};

export type StrategyExecutor = (
  app: Hono<AppEnv>,
  rounds: BatchRequest[][],
  sharedHeaders: Record<string, string>,
  baseRequest: Request,
  baseContext: Context<AppEnv>,
  timeout: number,
) => Promise<BatchResult>;
