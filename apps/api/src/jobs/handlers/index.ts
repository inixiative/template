import { type CleanStaleDataPayload, cleanStaleData } from '#/jobs/handlers/cleanStaleData';
import { type DeliverEmailPayload, deliverEmail } from '#/jobs/handlers/deliverEmail';
import { rotateEncryptionKeys } from '#/jobs/handlers/rotateEncryptionKeys';
import { type SendEmailPayload, sendEmail } from '#/jobs/handlers/sendEmail';
import { type SendWebhookPayload, sendWebhook } from '#/jobs/handlers/sendWebhook';
import type { JobHandler } from '#/jobs/types';

export const JobHandlerName = {
  sendEmail: 'sendEmail',
  deliverEmail: 'deliverEmail',
  sendWebhook: 'sendWebhook',
  rotateEncryptionKeys: 'rotateEncryptionKeys',
  cleanStaleData: 'cleanStaleData',
} as const;

export type JobHandlerName = (typeof JobHandlerName)[keyof typeof JobHandlerName];

export type JobPayloads = {
  sendEmail: SendEmailPayload;
  deliverEmail: DeliverEmailPayload;
  sendWebhook: SendWebhookPayload;
  rotateEncryptionKeys: undefined;
  cleanStaleData: CleanStaleDataPayload;
};

export type JobHandlers = {
  [K in JobHandlerName]: JobHandler<JobPayloads[K]>;
};

export const jobHandlers: JobHandlers = {
  sendEmail,
  deliverEmail,
  sendWebhook,
  rotateEncryptionKeys,
  cleanStaleData,
};

export const isValidHandlerName = (name: string): name is JobHandlerName => name in jobHandlers;
