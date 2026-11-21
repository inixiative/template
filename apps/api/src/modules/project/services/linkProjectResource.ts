/**
 * @atlas
 * @kind service
 * @partOf feature:project
 * @uses infrastructure:prisma, primitive:authz
 */
import { db } from '@template/db';
import type { ProjectIntegrationResource } from '@template/db/generated/client/client';
import { IntegrationResourceStatus } from '@template/db/generated/client/enums';
import type { Permix } from '@template/permissions/client';
import { makeError } from '#/lib/errors';
import { holdsOnRecord } from '#/lib/permissions/holdsOnRecord';

/**
 * Links a tracked or missing integration resource to a project once (an untracked one is refused): a live link is kept, a new one needs `create`
 * on the link (`manage` on the project and `operate` on the resource). An unlinked pair is linked
 * again with a new row.
 */
export const linkProjectResource = async (
  permix: Permix,
  pair: { projectId: string; integrationResourceId: string },
) =>
  db.txn(async () => {
    const { status } = await db.integrationResource.findUniqueOrThrow({
      where: { id: pair.integrationResourceId },
      select: { status: true },
    });
    if (status === IntegrationResourceStatus.untracked)
      throw makeError({
        status: 409,
        message: 'This resource is untracked: track it before linking it',
      });
    const [live] = await db.findForUpdate<ProjectIntegrationResource>(
      'ProjectIntegrationResource',
      pair,
      { upserting: true },
    );
    if (live) return live;
    if (!(await holdsOnRecord(permix, 'projectIntegrationResource', { id: '', ...pair }, 'create')))
      throw makeError({ status: 403, message: 'Access denied' });
    return db.projectIntegrationResource.create({ data: pair });
  });
