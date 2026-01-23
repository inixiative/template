import type { JobHandler, WorkerContext } from '../types';

type SendWebhookPayload = {
  subscriptionId: string;
  event: string;
  data: Record<string, unknown>;
};

export const sendWebhook: JobHandler<SendWebhookPayload> = async (
  ctx: WorkerContext,
  payload: SendWebhookPayload,
) => {
  const { subscriptionId, event, data } = payload;

  console.log(`Sending webhook for event ${event} to subscription ${subscriptionId}`);

  // TODO: Implement webhook delivery
  // 1. Fetch webhook subscription from DB
  // 2. Sign payload with subscription secret
  // 3. Send HTTP request to subscription URL
  // 4. Record delivery status

  console.log(`Webhook sent successfully`);
};
