/**
 * @atlas
 * @kind service
 * @partOf feature:integrations, feature:webhooks
 * @uses infrastructure:prisma
 */
import { db, polymorphicKeyColumnOrThrow } from '@template/db';
import type { WebhookModel } from '@template/db/generated/client/enums';

export const isIntegrationRecordPoisoned = async (input: {
  integrationId: string;
  recordModel: WebhookModel;
  recordId: string;
}): Promise<boolean> => {
  const record = await db.integrationRecord.findFirst({
    where: {
      integrationId: input.integrationId,
      [polymorphicKeyColumnOrThrow('IntegrationRecord', 'recordModel', input.recordModel)]:
        input.recordId,
      poisonedAt: { not: null },
    },
    select: { id: true },
  });
  return record != null;
};
