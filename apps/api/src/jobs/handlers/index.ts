import { type SendWebhookPayload, sendWebhook } from '#/jobs/handlers/sendWebhook';
import type { JobHandler } from '#/jobs/types';

export const JobHandlerName = {
  sendWebhook: 'sendWebhook',
} as const;

export type JobHandlerName = (typeof JobHandlerName)[keyof typeof JobHandlerName];

export type JobPayloads = {
  sendWebhook: SendWebhookPayload;
};

export type JobHandlers = {
  [K in JobHandlerName]: JobHandler<JobPayloads[K]>;
};

export const jobHandlers: JobHandlers = {
  sendWebhook,
};

export const isValidHandlerName = (name: string): name is JobHandlerName => name in jobHandlers;
