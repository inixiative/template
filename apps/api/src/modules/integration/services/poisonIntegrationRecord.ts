/**
 * @atlas
 * @kind service
 * @partOf feature:integrations, feature:webhooks
 * @uses infrastructure:prisma, infrastructure:redis
 */
import { db } from '@template/db';
import type { IntegrationRecord } from '@template/db/generated/client/client';
import type { WebhookModel } from '@template/db/generated/client/enums';
import { integrationRecordForeignKeyForModel } from '#/modules/integration/services/integrationRecordForeignKeyForModel';

export const poisonIntegrationRecord = (input: {
  integrationId: string;
  model: WebhookModel;
  resourceId: string;
  reason: string;
}): Promise<IntegrationRecord> =>
  db.txn(async () => {
    const recordKey = {
      integrationId: input.integrationId,
      [integrationRecordForeignKeyForModel(input.model)]: input.resourceId,
    };
    const poison = { poisonedAt: new Date(), poisonedReason: input.reason };
    if (
      !(await db.integration.findUnique({
        where: { id: input.integrationId },
        select: { id: true },
      }))
    )
      throw new Error(`Integration ${input.integrationId} is gone; its records cannot be poisoned`);

    const held = await db.findForUpdate<IntegrationRecord>('IntegrationRecord', recordKey, {
      upserting: true,
    });
    const existing = held.find((row) => row.deletedAt === null);
    if (existing?.poisonedAt) return existing;
    if (existing) return db.integrationRecord.update({ where: { id: existing.id }, data: poison });
    return db.integrationRecord.create({ data: { ...recordKey, model: input.model, ...poison } });
  });
