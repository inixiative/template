/**
 * @atlas
 * @kind controller
 * @partOf feature:project
 * @uses infrastructure:prisma, primitive:authz, primitive:errors
 */

import { contextResource } from '#/lib/context/contextResource';
import { makeError } from '#/lib/errors';
import { holdsOnRecord } from '#/lib/permissions/holdsOnRecord';
import { makeController } from '#/lib/utils/makeController';
import { projectCreateProjectIntegrationRoute } from '#/modules/project/routes/projectCreateProjectIntegration';
import { validateOnePerProjectLinkFree } from '#/modules/projectIntegration/validations/validateOnePerProjectLinkFree';

export const projectCreateProjectIntegrationController = makeController(
  projectCreateProjectIntegrationRoute,
  async (c, respond) => {
    const db = c.get('db');
    const project = contextResource<'project'>(c);
    const { integrationId } = c.req.valid('json');

    const integration = await db.integration.findFirst({ where: { id: integrationId } });
    if (!integration) throw makeError({ status: 404, message: 'Integration not found' });

    const pair = { projectId: project.id, integrationId: integration.id };
    if (
      !(await holdsOnRecord(c.get('permix'), 'projectIntegration', { id: '', ...pair }, 'create'))
    )
      throw makeError({ status: 403, message: 'Access denied' });

    const linked = await db.txn(async () => {
      await validateOnePerProjectLinkFree(project.id, integration);
      return db.withDeleted(() =>
        db.projectIntegration.upsert({
          where: { projectId_integrationId: pair },
          create: pair,
          update: { deletedAt: null },
        }),
      );
    });

    return respond.created(linked);
  },
);
