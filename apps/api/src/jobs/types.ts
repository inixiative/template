import type { ExtendedPrismaClient } from '@template/db';
import type { Job, Queue } from 'bullmq';

export type WorkerContext = {
  db: ExtendedPrismaClient;
  queue: Queue;
  job: Job;
  signal?: AbortSignal;
};

export type JobHandler<TPayload = unknown> = (ctx: WorkerContext, payload: TPayload) => Promise<void>;

// Define job handler names here
export const JobHandlerName = {
  sendWebhook: 'sendWebhook',
  processInvestment: 'processInvestment',
  syncTokenBalances: 'syncTokenBalances',
} as const;

export type JobHandlerNameType = (typeof JobHandlerName)[keyof typeof JobHandlerName];
