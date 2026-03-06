import { type SendWebhookPayload, sendWebhook } from '#/jobs/handlers/sendWebhook';
import { rotateEncryptionKeys } from '#/jobs/handlers/rotateEncryptionKeys';
import { cleanStaleWebhooks } from '#/jobs/handlers/cleanStaleWebhooks';
import { cleanStaleAuditLogs } from '#/jobs/handlers/cleanStaleAuditLogs';
import type { JobHandler } from '#/jobs/types';

export const JobHandlerName = {
  sendWebhook: 'sendWebhook',
  rotateEncryptionKeys: 'rotateEncryptionKeys',
  cleanStaleWebhooks: 'cleanStaleWebhooks',
  cleanStaleAuditLogs: 'cleanStaleAuditLogs',
} as const;

export type JobHandlerName = (typeof JobHandlerName)[keyof typeof JobHandlerName];

export type JobPayloads = {
  sendWebhook: SendWebhookPayload;
  rotateEncryptionKeys: void;
  cleanStaleWebhooks: void;
  cleanStaleAuditLogs: void;
};

export type JobHandlers = {
  [K in JobHandlerName]: JobHandler<JobPayloads[K]>;
};

export const jobHandlers: JobHandlers = {
  sendWebhook,
  rotateEncryptionKeys,
  cleanStaleWebhooks,
  cleanStaleAuditLogs,
};

export const isValidHandlerName = (name: string): name is JobHandlerName => name in jobHandlers;
