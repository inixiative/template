/**
 * @atlas
 * @kind service
 * @partOf feature:integrations
 * @uses primitive:authz, infrastructure:prisma
 */
import { db, type EntitlementInput, type Prisma } from '@template/db';
import type { Permix } from '@template/permissions';
import { changeEntitlements } from '#/lib/permissions/changeEntitlements';
import { validateIntegrationRole } from '#/modules/integration/validations/validateIntegrationRole';

type IntegrationCreate = Prisma.IntegrationUncheckedCreateInput & {
  entitlements?: EntitlementInput[];
};

/** The integration and the entitlements it is created with, in one transaction. */
export const createIntegration = (
  writer: Permix,
  { entitlements = [], ...row }: IntegrationCreate,
) =>
  db.txn(async () => {
    await validateIntegrationRole(writer, row);
    const integration = await db.integration.create({ data: row });
    const targetEntitlements = await changeEntitlements(
      writer,
      { model: 'Integration', id: integration.id },
      { add: entitlements },
    );
    return { ...integration, targetEntitlements };
  });
