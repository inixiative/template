/**
 * @atlas
 * @kind service
 * @partOf feature:integrations
 * @uses primitive:authz, infrastructure:prisma, infrastructure:redis
 */
import { db, type EntitlementInput, type Prisma } from '@template/db';
import type { Integration } from '@template/db/generated/client/client';
import type { Permix } from '@template/permissions';
import { isIntegrationOnePer } from '@template/shared/integrations/integrationOnePer';
import { omit, orderBy, pickBy } from 'lodash-es';
import { changeEntitlements } from '#/lib/permissions/changeEntitlements';
import { fetchRevivedLinksOnTakenProjects } from '#/modules/integration/services/fetchRevivedLinksOnTakenProjects';
import { integrationProviderOwnerWhere } from '#/modules/integration/services/integrationProviderOwnerWhere';
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

    const owner = integrationProviderOwnerWhere(row);
    const locked = isIntegrationOnePer(row.provider, 'owner')
      ? await db.withDeleted(() =>
          db.findForUpdate<Pick<Integration, 'id' | 'provider' | 'deletedAt'>>(
            'Integration',
            pickBy(owner, (value) => value !== null),
            { upserting: true },
          ),
        )
      : [];
    const [existing] = orderBy(
      locked,
      [(found) => found.deletedAt !== null, 'deletedAt'],
      ['asc', 'desc'],
    );
    const linksOnTakenProjects = existing?.deletedAt
      ? await fetchRevivedLinksOnTakenProjects(existing)
      : [];

    const integration = existing
      ? await db.withDeleted(() =>
          db.integration.update({
            where: { id: existing.id },
            data: {
              ...omit(row, Object.keys(owner)),
              ...(existing.deletedAt ? { deletedAt: null } : {}),
            },
          }),
        )
      : await db.integration.create({ data: row });
    if (linksOnTakenProjects.length)
      await db.projectIntegration.updateManyAndReturn({
        where: { id: { in: linksOnTakenProjects } },
        data: { deletedAt: new Date() },
      });
    const targetEntitlements = await changeEntitlements(
      writer,
      { model: 'Integration', id: integration.id },
      { add: entitlements },
    );
    return { ...integration, targetEntitlements };
  });
