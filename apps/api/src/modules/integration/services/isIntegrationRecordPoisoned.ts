/**
 * @atlas
 * @kind service
 * @partOf feature:integrations, feature:webhooks
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { WebhookModel } from '@template/db/generated/client/enums';
import { integrationRecordColumn } from '#/modules/integration/services/integrationRecordColumn';

export const isIntegrationRecordPoisoned = async (input: {
  integrationId: string;
  model: WebhookModel;
  resourceId: string;
}): Promise<boolean> => {
  const record = await db.integrationRecord.findFirst({
    where: {
      integrationId: input.integrationId,
      [integrationRecordColumn(input.model)]: input.resourceId,
      poisonedAt: { not: null },
    },
    select: { id: true },
  });
  return record != null;
};
