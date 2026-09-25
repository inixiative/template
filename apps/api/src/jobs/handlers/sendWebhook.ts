/**
 * @atlas
 * @kind handler
 * @partOf primitive:jobs
 * @uses infrastructure:prisma, feature:webhooks
 */
import crypto from 'node:crypto';
import type { Db, Prisma } from '@template/db';
import type { WebhookEvent, WebhookEventAction, WebhookEventStatus } from '@template/db/generated/client/client';
import { log } from '@template/shared/logger';
import type { JobHandler } from '#/jobs/types';
import { isIntegrationRecordPoisoned } from '#/modules/integration/services/isIntegrationRecordPoisoned';
import { poisonIntegrationRecord } from '#/modules/integration/services/poisonIntegrationRecord';

export type SendWebhookPayload = {
  subscriptionId: string;
  action: WebhookEventAction;
  resourceId: string;
  data: Record<string, unknown>; // JSON payload to send
  timestamp: string; // ISO-8601 event time, stamped once at the hook
};

export const sendWebhook: JobHandler<SendWebhookPayload> = async (ctx, payload) => {
  const { subscriptionId, action, resourceId, data, timestamp } = payload;
  const { db } = ctx;

  const subscription = await db.webhookSubscription.findUnique({ where: { id: subscriptionId } });
  if (!subscription?.isActive) {
    log.info(`Webhook subscription ${subscriptionId} not found or inactive - skipping`);
    return;
  }

  if (
    subscription.integrationId &&
    (await isIntegrationRecordPoisoned({
      integrationId: subscription.integrationId,
      model: subscription.model,
      resourceId,
    }))
  ) {
    log.info(`Webhook record ${resourceId} is poisoned for integration ${subscription.integrationId} - skipping`);
    return;
  }

  // timestamp (event time, carried from the hook) is inside the signed body so receivers can reject replays
  const body = { model: subscription.model, action, payload: data, timestamp };
  const bodyJson = JSON.stringify(body);

  // Sign payload with RSA-SHA256
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(bodyJson);
  signer.end();
  const signature = signer.sign(process.env.WEBHOOK_SIGNING_PRIVATE_KEY, 'base64');

  let status: WebhookEventStatus = 'success';
  let error: string | undefined;
  let httpStatus: number | undefined;

  try {
    const response = await fetch(subscription.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': signature },
      body: bodyJson,
      // Never follow redirects: the URL passed SSRF validation at registration, but a
      // 3xx hop has not — following it would let a receiver bounce us to an internal
      // address (e.g. cloud metadata) and POST the signed body there.
      redirect: 'manual',
      signal: AbortSignal.timeout(5000),
    });
    httpStatus = response.status;

    if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
      error = `Blocked redirect from webhook URL (HTTP ${response.status})`;
      status = 'error';
    } else if (!response.ok) {
      error = `HTTP ${response.status}: ${response.statusText}`;
      status = response.status >= 500 || response.status === 404 ? 'unreachable' : 'error';
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    status = 'unreachable';
  }

  await db.webhookEvent.create({
    data: {
      status,
      action,
      resourceId,
      error,
      httpStatus,
      payload: data as object,
      webhookSubscriptionId: subscriptionId,
    },
  });

  if (status === 'success') {
    log.info(`Webhook delivered to ${subscription.url}`);
    return;
  }

  log.info(`Webhook delivery failed: ${error}`);

  if (
    subscription.integrationId &&
    isRecordRejection({ status, httpStatus }) &&
    (await isRecordRejected(db, subscriptionId, resourceId))
  ) {
    await poisonIntegrationRecord({
      integrationId: subscription.integrationId,
      model: subscription.model,
      resourceId,
      reason: error ?? 'rejected by the integration',
    });
    log.info(`Webhook record ${resourceId} poisoned for integration ${subscription.integrationId}`);
  }

  // Circuit breaker: disable subscription if last N deliveries all failed
  const FAILURE_THRESHOLD = 5;
  const recentEvents = await db.webhookEvent.findMany({
    where: { webhookSubscriptionId: subscriptionId },
    orderBy: { createdAt: 'desc' },
    take: FAILURE_THRESHOLD,
    select: { status: true },
  });

  const allFailed =
    recentEvents.length >= FAILURE_THRESHOLD &&
    recentEvents.every((e: Pick<WebhookEvent, 'status'>) => e.status !== 'success');
  if (allFailed) {
    await db.webhookSubscription.update({ where: { id: subscriptionId }, data: { isActive: false } });
    log.info(`Webhook subscription ${subscriptionId} disabled after ${FAILURE_THRESHOLD} consecutive failures`);
  }
};

const RECORD_FAILURE_THRESHOLD = 3;

// Only a refusal of the record's content counts; redirects, auth, conflicts and rate limits say nothing about the record.
const RECORD_REJECTION = { status: 'error', httpStatus: { in: [400, 422] } } satisfies Prisma.WebhookEventWhereInput;

const isRecordRejection = (event: { status: WebhookEventStatus; httpStatus?: number }): boolean =>
  event.status === RECORD_REJECTION.status &&
  event.httpStatus != null &&
  RECORD_REJECTION.httpStatus.in.includes(event.httpStatus);

// Ordered by id, not createdAt: ids are uuidv7, so events in the same millisecond still order exactly.
const isRecordRejected = async (db: Db, subscriptionId: string, resourceId: string): Promise<boolean> => {
  const lastSuccess = await db.webhookEvent.findFirst({
    where: { webhookSubscriptionId: subscriptionId, resourceId, status: 'success' },
    orderBy: { id: 'desc' },
    select: { id: true },
  });
  const rejections = await db.webhookEvent.findMany({
    where: {
      webhookSubscriptionId: subscriptionId,
      resourceId,
      ...RECORD_REJECTION,
      ...(lastSuccess ? { id: { gt: lastSuccess.id } } : {}),
    },
    orderBy: { id: 'asc' },
    take: RECORD_FAILURE_THRESHOLD,
    select: { id: true },
  });
  const [firstRejection] = rejections;
  if (!firstRejection || rejections.length < RECORD_FAILURE_THRESHOLD) return false;

  const otherDelivered = await db.webhookEvent.findFirst({
    where: {
      webhookSubscriptionId: subscriptionId,
      resourceId: { not: resourceId },
      status: 'success',
      id: { gt: firstRejection.id },
    },
    select: { id: true },
  });
  return otherDelivered != null;
};
