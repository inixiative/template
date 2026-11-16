/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */
import { WebhookModel, WebhookOwnerModel } from '@template/db/generated/client/enums';

export const webhookOwnerAllowedModels: Record<WebhookOwnerModel, WebhookModel[]> = {
  [WebhookOwnerModel.User]: [WebhookModel.CustomerRef, WebhookModel.Artifact],
  [WebhookOwnerModel.Organization]: [WebhookModel.CustomerRef, WebhookModel.Artifact],
  [WebhookOwnerModel.Space]: [WebhookModel.CustomerRef, WebhookModel.Artifact],
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
