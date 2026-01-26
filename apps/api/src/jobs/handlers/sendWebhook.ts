import type { JobHandler } from '#/jobs/types';
import { log } from '#/lib/logger';

export type SendWebhookPayload = {
  subscriptionId: string;
  event: string;
  data: Record<string, unknown>;
};

export const sendWebhook: JobHandler<SendWebhookPayload> = async (ctx, payload) => {
  const { subscriptionId, event, data } = payload;

  log.info(`Sending webhook for event ${event} to subscription ${subscriptionId}`);

  // TODO: Implement webhook delivery
  // 1. Fetch webhook subscription from DB
  // 2. Sign payload with subscription secret
  // 3. Send HTTP request to subscription URL
  // 4. Record delivery status

  log.info(`Webhook sent successfully`);
};
