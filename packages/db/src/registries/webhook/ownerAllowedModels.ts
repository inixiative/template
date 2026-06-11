/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 */
import { WebhookModel, WebhookOwnerModel } from '@template/db/generated/client/enums';

export const webhookOwnerAllowedModels: Record<WebhookOwnerModel, WebhookModel[]> = {
  [WebhookOwnerModel.User]: [WebhookModel.CustomerRef],
  [WebhookOwnerModel.Organization]: [WebhookModel.CustomerRef],
  [WebhookOwnerModel.Space]: [WebhookModel.CustomerRef],
};

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
