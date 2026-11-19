/**
 * @atlas
 * @kind service
 * @partOf feature:integrations, feature:webhooks
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { WebhookModel } from '@template/db/generated/client/enums';
import { integrationRecordForeignKeyForModel } from '#/modules/integration/services/integrationRecordForeignKeyForModel';

export const isIntegrationRecordPoisoned = async (input: {
  integrationId: string;
  recordModel: WebhookModel;
  resourceId: string;
}): Promise<boolean> => {
  const record = await db.integrationRecord.findFirst({
    where: {
      integrationId: input.integrationId,
      [integrationRecordForeignKeyForModel(input.recordModel)]: input.resourceId,
      poisonedAt: { not: null },
    },
    select: { id: true },
  });
  return record != null;
};
