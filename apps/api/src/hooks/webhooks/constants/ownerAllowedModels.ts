import { WebhookModel, WebhookOwnerModel } from '@template/db';

/**
 * What models can each owner type subscribe to?
 * This is the source of truth - modelSubscribers is derived from this.
 */
export const webhookOwnerAllowedModels: Record<WebhookOwnerModel, WebhookModel[]> = {
  [WebhookOwnerModel.User]: [WebhookModel.User],
  [WebhookOwnerModel.Organization]: [WebhookModel.User, WebhookModel.Organization],
};

/**
 * Derived: What owner types care about each model?
 */
export const webhookModelSubscribers = Object.entries(webhookOwnerAllowedModels).reduce(
  (acc, [ownerModel, models]) => {
    for (const model of models) {
      acc[model] ??= [];
      acc[model].push(ownerModel as WebhookOwnerModel);
    }
    return acc;
  },
  {} as Record<WebhookModel, WebhookOwnerModel[]>,
);
