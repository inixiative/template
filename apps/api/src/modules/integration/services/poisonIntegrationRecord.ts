/**
 * @atlas
 * @kind service
 * @partOf feature:integrations, feature:webhooks
 * @uses infrastructure:prisma, infrastructure:redis
 */
import { db, polymorphicKeyColumnOrThrow } from '@template/db';
import type { IntegrationRecord } from '@template/db/generated/client/client';
import type { WebhookModel } from '@template/db/generated/client/enums';

export const poisonIntegrationRecord = (input: {
  integrationId: string;
  recordModel: WebhookModel;
  recordId: string;
  reason: string;
}): Promise<IntegrationRecord> =>
  db.txn(async () => {
    const recordKey = {
      integrationId: input.integrationId,
      [polymorphicKeyColumnOrThrow('IntegrationRecord', 'recordModel', input.recordModel)]:
        input.recordId,
    };
    const poison = { poisonedAt: new Date(), poisonedReason: input.reason };

    const [existing] = await db.findForUpdate<IntegrationRecord>('IntegrationRecord', recordKey, {
      upserting: true,
    });
    if (existing?.poisonedAt) return existing;
    if (existing) return db.integrationRecord.update({ where: { id: existing.id }, data: poison });
    return db.integrationRecord.create({
      data: { ...recordKey, recordModel: input.recordModel, ...poison },
    });
  });
