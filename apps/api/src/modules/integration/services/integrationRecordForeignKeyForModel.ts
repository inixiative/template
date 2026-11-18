/**
 * @atlas
 * @kind utils, service
 * @partOf feature:integrations
 * @uses infrastructure:prisma
 */
import { PolymorphismRegistry, polymorphicKeyColumn } from '@template/db';
import type { WebhookModel } from '@template/db/generated/client/enums';

const [recordAxis] = PolymorphismRegistry.IntegrationRecord.axes;

export const integrationRecordForeignKeyForModel = (model: WebhookModel): string =>
  polymorphicKeyColumn('IntegrationRecord', recordAxis.field, model) as string;
