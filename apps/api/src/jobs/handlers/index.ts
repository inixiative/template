import { cleanStaleWebhooks } from '#/jobs/handlers/cleanStaleWebhooks';
import { rotateEncryptionKeys } from '#/jobs/handlers/rotateEncryptionKeys';
import { type SendWebhookPayload, sendWebhook } from '#/jobs/handlers/sendWebhook';
import type { JobHandler } from '#/jobs/types';

export const JobHandlerName = {
  sendWebhook: 'sendWebhook',
  rotateEncryptionKeys: 'rotateEncryptionKeys',
  cleanStaleWebhooks: 'cleanStaleWebhooks',
} as const;

export type JobHandlerName = (typeof JobHandlerName)[keyof typeof JobHandlerName];

export type JobPayloads = {
  sendWebhook: SendWebhookPayload;
  rotateEncryptionKeys: void;
  cleanStaleWebhooks: void;
};

export type JobHandlers = {
  [K in JobHandlerName]: JobHandler<JobPayloads[K]>;
};

export const jobHandlers: JobHandlers = {
  sendWebhook,
  rotateEncryptionKeys,
  cleanStaleWebhooks,
};

export const isValidHandlerName = (name: string): name is JobHandlerName => name in jobHandlers;
