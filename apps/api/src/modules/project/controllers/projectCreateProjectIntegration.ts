/**
 * @atlas
 * @kind controller
 * @partOf feature:project
 * @uses infrastructure:prisma, primitive:authz, primitive:errors
 */
import { type HydratedRecord, hydrate } from '@template/db';
import type { ProjectIntegration } from '@template/db/generated/client/client';
import { check, rebacSchema } from '@template/permissions/rebac';
import { contextResource } from '#/lib/context/contextResource';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { projectCreateProjectIntegrationRoute } from '#/modules/project/routes/projectCreateProjectIntegration';

export const projectCreateProjectIntegrationController = makeController(
  projectCreateProjectIntegrationRoute,
  async (c, respond) => {
    const db = c.get('db');
    const permix = c.get('permix');
    const project = contextResource<'project'>(c);
    const { integrationId } = c.req.valid('json');

    const integration = await db.integration.findFirst({ where: { id: integrationId } });
    if (!integration) {
      throw makeError({ status: 404, message: 'Integration not found' });
    }

    const hydrated = await hydrate('projectIntegration', {
      id: '',
      projectId: project.id,
      integrationId: integration.id,
    } as HydratedRecord);

    if (!check(permix, rebacSchema, 'projectIntegration', hydrated, 'create')) {
      throw makeError({ status: 403, message: 'Access denied' });
    }

    const created = await db.txn(async () => {
      const existing = await db.findForUpdate<ProjectIntegration>(
        'ProjectIntegration',
        { projectId: project.id, integrationId: integration.id },
        { upserting: true },
      );
      if (existing.some((row) => row.deletedAt === null)) {
        throw makeError({
          status: 409,
          message: 'Integration is already linked to this project',
        });
      }
      return db.projectIntegration.create({
        data: {
          projectId: project.id,
          integrationId: integration.id,
        },
      });
    });

    return respond.created(created);
  },
);
