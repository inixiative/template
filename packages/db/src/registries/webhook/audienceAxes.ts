/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */
import { WebhookModel } from '@template/db/generated/client/enums';

export const webhookAudienceAxes: Record<WebhookModel, string[]> = {
  [WebhookModel.CustomerRef]: ['customerModel', 'providerModel'],
  [WebhookModel.Artifact]: [],
};
