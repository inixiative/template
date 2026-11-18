import { coordinateRollingCaches } from '#/jobs/handlers/coordinateRollingCaches';
import { type DeliverEmailPayload, deliverEmail } from '#/jobs/handlers/deliverEmail';
import {
  type HardDeleteRecordsPastRetentionPayload,
  hardDeleteRecordsPastRetention,
} from '#/jobs/handlers/hardDeleteRecordsPastRetention';
import {
  type PlanEmailDeliveriesPayload,
  planEmailDeliveries,
} from '#/jobs/handlers/planEmailDeliveries';
import {
  type RecomputeEmailDependentsPayload,
  recomputeEmailDependents,
} from '#/jobs/handlers/recomputeEmailDependents';
import {
  type ReconcileCustomerRelationshipSegmentsPayload,
  reconcileCustomerRelationshipSegments,
} from '#/jobs/handlers/reconcileCustomerRelationshipSegments';
import { reconcileEveryHealthyDynamicSegment } from '#/jobs/handlers/reconcileEveryHealthyDynamicSegment';
import { type ReconcileSegmentPayload, reconcileSegment } from '#/jobs/handlers/reconcileSegment';
import {
  type RefreshRollingCachePayload,
  refreshRollingCache,
} from '#/jobs/handlers/refreshRollingCache';
import {
  type RefreshRollingCacheTargetPayload,
  refreshRollingCacheTarget,
} from '#/jobs/handlers/refreshRollingCacheTarget';
import { rotateEncryptionKeys } from '#/jobs/handlers/rotateEncryptionKeys';
import { type SendWebhookPayload, sendWebhook } from '#/jobs/handlers/sendWebhook';
import type { JobHandler } from '#/jobs/types';

export const JobHandlerName = {
  planEmailDeliveries: 'planEmailDeliveries',
  deliverEmail: 'deliverEmail',
  sendWebhook: 'sendWebhook',
  rotateEncryptionKeys: 'rotateEncryptionKeys',
  hardDeleteRecordsPastRetention: 'hardDeleteRecordsPastRetention',
  reconcileSegment: 'reconcileSegment',
  reconcileCustomerRelationshipSegments: 'reconcileCustomerRelationshipSegments',
  reconcileEveryHealthyDynamicSegment: 'reconcileEveryHealthyDynamicSegment',
  recomputeEmailDependents: 'recomputeEmailDependents',
  coordinateRollingCaches: 'coordinateRollingCaches',
  refreshRollingCache: 'refreshRollingCache',
  refreshRollingCacheTarget: 'refreshRollingCacheTarget',
} as const;

export type JobHandlerName = (typeof JobHandlerName)[keyof typeof JobHandlerName];

export type JobPayloads = {
  planEmailDeliveries: PlanEmailDeliveriesPayload;
  deliverEmail: DeliverEmailPayload;
  sendWebhook: SendWebhookPayload;
  rotateEncryptionKeys: undefined;
  hardDeleteRecordsPastRetention: HardDeleteRecordsPastRetentionPayload;
  reconcileSegment: ReconcileSegmentPayload;
  reconcileCustomerRelationshipSegments: ReconcileCustomerRelationshipSegmentsPayload;
  reconcileEveryHealthyDynamicSegment: undefined;
  recomputeEmailDependents: RecomputeEmailDependentsPayload;
  coordinateRollingCaches: undefined;
  refreshRollingCache: RefreshRollingCachePayload;
  refreshRollingCacheTarget: RefreshRollingCacheTargetPayload;
};

export type JobHandlers = {
  [K in JobHandlerName]: JobHandler<JobPayloads[K]>;
};

export const jobHandlers: JobHandlers = {
  planEmailDeliveries,
  deliverEmail,
  sendWebhook,
  rotateEncryptionKeys,
  hardDeleteRecordsPastRetention,
  reconcileSegment,
  reconcileCustomerRelationshipSegments,
  reconcileEveryHealthyDynamicSegment,
  recomputeEmailDependents,
  coordinateRollingCaches,
  refreshRollingCache,
  refreshRollingCacheTarget,
};

export const isValidHandlerName = (name: string): name is JobHandlerName => name in jobHandlers;
