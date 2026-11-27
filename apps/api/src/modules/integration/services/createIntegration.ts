/**
 * @atlas
 * @kind service
 * @partOf feature:integrations
 * @uses primitive:authz, infrastructure:prisma, infrastructure:redis
 */
import { db, type EntitlementInput, type Prisma, polymorphicKeyColumns } from '@template/db';
import type { Integration } from '@template/db/generated/client/client';
import type { Permix } from '@template/permissions';
import { isIntegrationOnePer } from '@template/shared/integrations/integrationOnePer';
import { omit, orderBy, pick } from 'lodash-es';
import { changeEntitlements } from '#/lib/permissions/changeEntitlements';
import { validateIntegrationConfiguration } from '#/modules/integration/validations/validateIntegrationConfiguration';
import { validateIntegrationRole } from '#/modules/integration/validations/validateIntegrationRole';
import { fetchOtherOnePerProjectLink } from '#/modules/projectIntegration/services/fetchOtherOnePerProjectLink';

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

    const grantEntitlements = async (integration: Integration) => ({
      ...integration,
      targetEntitlements: await changeEntitlements(
        writer,
        { model: 'Integration', id: integration.id },
        { add: entitlements },
      ),
    });

    if (!isIntegrationOnePer(row.provider, 'owner'))
      return grantEntitlements(await db.integration.create({ data: row }));

    const ownerColumns = [
      'provider',
      'ownerModel',
      ...polymorphicKeyColumns('Integration', 'ownerModel', row.ownerModel),
    ];
    const ownersRows = await db.withDeleted(() =>
      db.findForUpdate<Pick<Integration, 'id' | 'provider' | 'deletedAt'>>(
        'Integration',
        pick(row, ownerColumns),
        { upserting: true },
      ),
    );
    const [existing] = orderBy(
      ownersRows,
      [(found) => found.deletedAt !== null, 'deletedAt'],
      ['asc', 'desc'],
    );
    if (!existing) return grantEntitlements(await db.integration.create({ data: row }));

    const revivedLinks =
      existing.deletedAt && isIntegrationOnePer(row.provider, 'project')
        ? await db.withDeleted(() =>
            db.projectIntegration.findMany({
              where: { integrationId: existing.id, deletedAt: existing.deletedAt },
              select: { id: true, projectId: true },
            }),
          )
        : [];
    const linksOnTakenProjects: string[] = [];
    for (const link of revivedLinks)
      if (await fetchOtherOnePerProjectLink(link.projectId, existing))
        linksOnTakenProjects.push(link.id);

    const integration = await db.withDeleted(() =>
      db.integration.update({
        where: { id: existing.id },
        data: { ...omit(row, ownerColumns), ...(existing.deletedAt ? { deletedAt: null } : {}) },
      }),
    );
    if (linksOnTakenProjects.length)
      await db.projectIntegration.updateManyAndReturn({
        where: { id: { in: linksOnTakenProjects } },
        data: { deletedAt: new Date() },
      });
    return grantEntitlements(integration);
  });
