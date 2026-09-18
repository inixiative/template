import { type CleanStaleDataPayload, cleanStaleData } from '#/jobs/handlers/cleanStaleData';
import { type DeliverEmailPayload, deliverEmail } from '#/jobs/handlers/deliverEmail';
import {
  type ReconcileCustomerRefSegmentsPayload,
  reconcileCustomerRefSegments,
} from '#/jobs/handlers/reconcileCustomerRefSegments';
import { type ReconcileSegmentPayload, reconcileSegment } from '#/jobs/handlers/reconcileSegment';
import { rotateEncryptionKeys } from '#/jobs/handlers/rotateEncryptionKeys';
import { type SendEmailPayload, sendEmail } from '#/jobs/handlers/sendEmail';
import { type SendWebhookPayload, sendWebhook } from '#/jobs/handlers/sendWebhook';
import { sweepSegments } from '#/jobs/handlers/sweepSegments';
import type { JobHandler } from '#/jobs/types';

export const JobHandlerName = {
  sendEmail: 'sendEmail',
  deliverEmail: 'deliverEmail',
  sendWebhook: 'sendWebhook',
  rotateEncryptionKeys: 'rotateEncryptionKeys',
  cleanStaleData: 'cleanStaleData',
  reconcileSegment: 'reconcileSegment',
  reconcileCustomerRefSegments: 'reconcileCustomerRefSegments',
  sweepSegments: 'sweepSegments',
} as const;

export type JobHandlerName = (typeof JobHandlerName)[keyof typeof JobHandlerName];

export type JobPayloads = {
  sendEmail: SendEmailPayload;
  deliverEmail: DeliverEmailPayload;
  sendWebhook: SendWebhookPayload;
  rotateEncryptionKeys: undefined;
  cleanStaleData: CleanStaleDataPayload;
  reconcileSegment: ReconcileSegmentPayload;
  reconcileCustomerRefSegments: ReconcileCustomerRefSegmentsPayload;
  sweepSegments: undefined;
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
  reconcileSegment,
  reconcileCustomerRefSegments,
  sweepSegments,
};

export const isValidHandlerName = (name: string): name is JobHandlerName => name in jobHandlers;
