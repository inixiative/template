/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */
import { WebhookModel } from '@template/db/generated/client/enums';

export const webhookEnabledModels: WebhookModel[] = [WebhookModel.CustomerRef];
