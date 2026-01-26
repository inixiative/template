import type { WebhookModel, WebhookOwnerModel } from '@template/db';

/**
 * Webhook Subscribers
 *
 * When a model changes, who should be notified?
 *
 * Maps: WebhookModel → WebhookOwnerModel → (extract owner ID from record)
 */
export const WEBHOOK_SUBSCRIBERS: Partial<
  Record<WebhookModel, Partial<Record<WebhookOwnerModel, (data: Record<string, unknown>) => string | null>>>
> = {
  // [WebhookModel.User]: {
  //   [WebhookOwnerModel.User]: (data) => data.id as string,
  // },
  // [WebhookModel.Organization]: {
  //   [WebhookOwnerModel.Organization]: (data) => data.id as string,
  // },
};
