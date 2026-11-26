/**
 * @atlas
 * @kind service
 * @partOf feature:integrations
 * @uses primitive:authz, infrastructure:prisma
 */
import { db, type EntitlementInput, type Prisma } from '@template/db';
import type { Permix } from '@template/permissions';
import { omit } from 'lodash-es';
import { changeEntitlements } from '#/lib/permissions/changeEntitlements';
import { fetchOnePerOwnerIntegrationForUpdate } from '#/modules/integration/services/fetchOnePerOwnerIntegrationForUpdate';
import { integrationOwnerKey } from '#/modules/integration/services/integrationOwnerKey';
import { validateIntegrationConfiguration } from '#/modules/integration/validations/validateIntegrationConfiguration';
import { validateIntegrationRole } from '#/modules/integration/validations/validateIntegrationRole';

type IntegrationCreate = Prisma.IntegrationUncheckedCreateInput & {
  entitlements?: EntitlementInput[];
};

export const createIntegration = (
  writer: Permix,
  { entitlements = [], ...row }: IntegrationCreate,
) =>
  db.txn(async () => {
    validateIntegrationConfiguration(row);
    await validateIntegrationRole(writer, row);
    const existing = await fetchOnePerOwnerIntegrationForUpdate(row);
    const integration = existing
      ? await db.withDeleted(() =>
          db.integration.update({
            where: { id: existing.id },
            data: {
              ...omit(row, Object.keys(integrationOwnerKey(row))),
              ...(existing.deletedAt ? { deletedAt: null } : {}),
            },
          }),
        )
      : await db.integration.create({ data: row });
    const targetEntitlements = await changeEntitlements(
      writer,
      { model: 'Integration', id: integration.id },
      { add: entitlements },
    );
    return { ...integration, targetEntitlements };
  });
