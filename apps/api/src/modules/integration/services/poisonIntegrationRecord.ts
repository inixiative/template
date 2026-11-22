/**
 * @atlas
 * @kind service
 * @partOf feature:integrations, feature:webhooks
 * @uses infrastructure:prisma
 */
import { db, polymorphicKeyColumnOrThrow } from '@template/db';
import type { IntegrationRecord, Prisma } from '@template/db/generated/client/client';
import type { WebhookModel } from '@template/db/generated/client/enums';

const recordUniqueKeyForModel: Record<
  WebhookModel,
  (integrationId: string, recordId: string) => Prisma.IntegrationRecordWhereUniqueInput
> = {
  CustomerRelationship: (integrationId, recordCustomerRelationshipId) => ({
    integrationId_recordCustomerRelationshipId: { integrationId, recordCustomerRelationshipId },
  }),
};

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
    if (
      !(await db.integration.findUnique({
        where: { id: input.integrationId },
        select: { id: true },
      }))
    )
      throw new Error(`Integration ${input.integrationId} is gone; its records cannot be poisoned`);

    const record = await db.withDeleted(() =>
      db.integrationRecord.upsert({
        where: recordUniqueKeyForModel[input.recordModel](input.integrationId, input.recordId),
        create: { ...recordKey, recordModel: input.recordModel, ...poison },
        update: { deletedAt: null },
      }),
    );
    if (record.poisonedAt) return record;
    return db.integrationRecord.update({ where: { id: record.id }, data: poison });
  });
