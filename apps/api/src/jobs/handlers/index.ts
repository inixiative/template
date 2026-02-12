import { type SendWebhookPayload, sendWebhook } from '#/jobs/handlers/sendWebhook';
import { rotateEncryptionKeys } from '#/jobs/handlers/rotateEncryptionKeys';
import type { JobHandler } from '#/jobs/types';

export const JobHandlerName = {
  sendWebhook: 'sendWebhook',
  rotateEncryptionKeys: 'rotateEncryptionKeys',
} as const;

export type JobHandlerName = (typeof JobHandlerName)[keyof typeof JobHandlerName];

export type JobPayloads = {
  sendWebhook: SendWebhookPayload;
  rotateEncryptionKeys: void;
};

export type JobHandlers = {
  [K in JobHandlerName]: JobHandler<JobPayloads[K]>;
};

export const jobHandlers: JobHandlers = {
  sendWebhook,
  rotateEncryptionKeys,
};

export const isValidHandlerName = (name: string): name is JobHandlerName => name in jobHandlers;
