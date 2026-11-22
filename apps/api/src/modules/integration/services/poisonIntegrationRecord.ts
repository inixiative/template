/**
 * @atlas
 * @kind service
 * @partOf feature:integrations, feature:webhooks
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { IntegrationRecord, Prisma } from '@template/db/generated/client/client';
import type { WebhookModel } from '@template/db/generated/client/enums';
import { integrationRecordForeignKeyForModel } from '#/modules/integration/services/integrationRecordForeignKeyForModel';

const recordUniqueKeyForModel: Record<
  WebhookModel,
  (integrationId: string, resourceId: string) => Prisma.IntegrationRecordWhereUniqueInput
> = {
  CustomerRelationship: (integrationId, customerRelationshipId) => ({
    integrationId_customerRelationshipId: { integrationId, customerRelationshipId },
  }),
};

export const poisonIntegrationRecord = (input: {
  integrationId: string;
  model: WebhookModel;
  resourceId: string;
  reason: string;
}): Promise<IntegrationRecord> =>
  db.txn(async () => {
    const recordForeignKey = integrationRecordForeignKeyForModel(input.model);
    const recordKey = { integrationId: input.integrationId, [recordForeignKey]: input.resourceId };
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
        where: recordUniqueKeyForModel[input.model](input.integrationId, input.resourceId),
        create: { ...recordKey, model: input.model, ...poison },
        update: { deletedAt: null },
      }),
    );
    if (record.poisonedAt) return record;
    return db.integrationRecord.update({ where: { id: record.id }, data: poison });
  });
