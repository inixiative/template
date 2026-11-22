/**
 * @atlas
 * @kind hook
 * @partOf feature:project
 * @uses infrastructure:prisma, primitive:errors
 */
import { DbAction, db, HookTiming, registerDbHook } from '@template/db';
import type { ProjectIntegration } from '@template/db/generated/client/client';
import { castArray } from 'lodash-es';
import { makeError } from '#/lib/errors';

type LinkRow = Partial<ProjectIntegration>;

const validateProjectIntegrationBoundary = async (row: LinkRow): Promise<void> => {
  if (!row.projectId || !row.integrationId) return;

  const [project, integration] = await Promise.all([
    db.project.findFirst({ where: { id: row.projectId, deletedAt: null } }),
    db.integration.findFirst({ where: { id: row.integrationId, deletedAt: null } }),
  ]);

  if (!project) {
    throw makeError({ status: 422, message: `Project ${row.projectId} not found` });
  }
  if (!integration) {
    throw makeError({ status: 422, message: `Integration ${row.integrationId} not found` });
  }

  if (project.organizationId !== integration.organizationId) {
    throw makeError({
      status: 422,
      message: 'Project and Integration must belong to the same organization',
    });
  }

  if (project.organizationId === null && project.userId !== integration.userId) {
    throw makeError({
      status: 422,
      message: 'Personal Project and Integration must belong to the same user',
    });
  }

  if (integration.spaceId !== null && project.spaceId !== integration.spaceId) {
    throw makeError({
      status: 422,
      message: 'Space-scoped Integration can only attach to a Project in the same space',
    });
  }
};

export const registerProjectIntegrationOwnerHook = () => {
  registerDbHook(
    'projectIntegrationOwner:create',
    'ProjectIntegration',
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn],
    async ({ args }) => {
      for (const row of castArray((args as { data: LinkRow | LinkRow[] }).data)) {
        await validateProjectIntegrationBoundary(row);
      }
    },
  );

  registerDbHook(
    'projectIntegrationOwner:upsert',
    'ProjectIntegration',
    HookTiming.before,
    [DbAction.upsert],
    async ({ args }) => {
      const a = args as { create?: LinkRow };
      if (a.create) await validateProjectIntegrationBoundary(a.create);
    },
  );
};
