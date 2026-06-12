import crypto from 'node:crypto';
import type { WebhookEvent, WebhookEventAction, WebhookEventStatus } from '@template/db/generated/client/client';
import { log } from '@template/shared/logger';
import type { JobHandler } from '#/jobs/types';
import { resolveWebhookUrlBlockReason } from '#/lib/webhooks/validators/resolveWebhookUrlBlockReason';

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

  const blockReason = await resolveWebhookUrlBlockReason(subscription.url);
  if (blockReason) {
    status = 'error';
    error = `Webhook URL ${blockReason}`;
  } else {
    try {
      const response = await fetch(subscription.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': signature },
        body: bodyJson,
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        error = `HTTP ${response.status}: ${response.statusText}`;
        status = response.status >= 500 || response.status === 404 ? 'unreachable' : 'error';
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      status = 'unreachable';
    }
  }

  await db.webhookEvent.create({
    data: { status, action, resourceId, error, payload: data as object, webhookSubscriptionId: subscriptionId },
  });

  if (status === 'success') {
    log.info(`Webhook delivered to ${subscription.url}`);
    return;
  }

  log.info(`Webhook delivery failed: ${error}`);

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
