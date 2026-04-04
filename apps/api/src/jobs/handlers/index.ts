import { cleanStaleAuditLogs } from '#/jobs/handlers/cleanStaleAuditLogs';
import { cleanStaleWebhooks } from '#/jobs/handlers/cleanStaleWebhooks';
import { type RecordAppEventPayload, recordAppEvent } from '#/jobs/handlers/recordAppEvent';
import { rotateEncryptionKeys } from '#/jobs/handlers/rotateEncryptionKeys';
import { type SendEmailPayload, sendEmail } from '#/jobs/handlers/sendEmail';
import { type SendWebhookPayload, sendWebhook } from '#/jobs/handlers/sendWebhook';
import type { JobHandler } from '#/jobs/types';

export const JobHandlerName = {
  recordAppEvent: 'recordAppEvent',
  sendEmail: 'sendEmail',
  sendWebhook: 'sendWebhook',
  rotateEncryptionKeys: 'rotateEncryptionKeys',
  cleanStaleWebhooks: 'cleanStaleWebhooks',
  cleanStaleAuditLogs: 'cleanStaleAuditLogs',
} as const;

export type JobHandlerName = (typeof JobHandlerName)[keyof typeof JobHandlerName];

export type JobPayloads = {
  recordAppEvent: RecordAppEventPayload;
  sendEmail: SendEmailPayload;
  sendWebhook: SendWebhookPayload;
  rotateEncryptionKeys: undefined;
  cleanStaleWebhooks: undefined;
  cleanStaleAuditLogs: undefined;
};

export type JobHandlers = {
  [K in JobHandlerName]: JobHandler<JobPayloads[K]>;
};

export const jobHandlers: JobHandlers = {
  recordAppEvent,
  sendEmail,
  sendWebhook,
  rotateEncryptionKeys,
  cleanStaleWebhooks,
  cleanStaleAuditLogs,
};

export const isValidHandlerName = (name: string): name is JobHandlerName => name in jobHandlers;
