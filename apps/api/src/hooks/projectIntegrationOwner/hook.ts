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

type RelationConnectInput = {
  connect?: { id?: string };
  create?: unknown;
  connectOrCreate?: unknown;
};

type LinkRow = Partial<ProjectIntegration> & {
  project?: RelationConnectInput;
  integration?: RelationConnectInput;
};

const extractRelationId = (
  directId: string | undefined,
  nested: RelationConnectInput | undefined,
  fieldLabel: 'projectId' | 'integrationId',
): string | undefined => {
  if (typeof directId === 'string' && directId.length > 0) return directId;
  if (!nested) return undefined;
  if (nested.create !== undefined || nested.connectOrCreate !== undefined) {
    throw makeError({
      status: 422,
      message: `ProjectIntegration requires an existing ${fieldLabel}; nested create/connectOrCreate is not allowed`,
    });
  }
  if (typeof nested.connect?.id === 'string' && nested.connect.id.length > 0) {
    return nested.connect.id;
  }
  throw makeError({
    status: 422,
    message: `ProjectIntegration ${fieldLabel} must reference an existing record by id`,
  });
};

const validateProjectIntegrationBoundary = async (
  projectId: string | undefined,
  integrationId: string | undefined,
): Promise<void> => {
  if (!projectId || !integrationId) return;

  const [project, integration] = await Promise.all([
    db.project.findFirst({ where: { id: projectId, deletedAt: null } }),
    db.integration.findFirst({ where: { id: integrationId, deletedAt: null } }),
  ]);

  if (!project) {
    throw makeError({ status: 422, message: `Project ${projectId} not found` });
  }
  if (!integration) {
    throw makeError({ status: 422, message: `Integration ${integrationId} not found` });
  }

  if (project.organizationId !== integration.organizationId) {
    throw makeError({
      status: 422,
      message: 'Project and Integration must belong to the same organization',
    });
  }

  if (integration.spaceId !== null && project.spaceId !== integration.spaceId) {
    throw makeError({
      status: 422,
      message: 'Space-scoped Integration can only attach to a Project in the same space',
    });
  }

  if (integration.userId !== null && project.userId !== integration.userId) {
    throw makeError({
      status: 422,
      message: 'User-scoped Integration can only attach to a Project owned by the same user',
    });
  }

  if (project.organizationId === null && project.userId !== integration.userId) {
    throw makeError({
      status: 422,
      message: 'Personal Project and Integration must belong to the same user',
    });
  }
};

const validateCreateRow = async (row: LinkRow): Promise<void> => {
  const projectId = extractRelationId(row.projectId, row.project, 'projectId');
  const integrationId = extractRelationId(row.integrationId, row.integration, 'integrationId');
  await validateProjectIntegrationBoundary(projectId, integrationId);
};

export const registerProjectIntegrationOwnerHook = () => {
  registerDbHook(
    'projectIntegrationOwner:create',
    'ProjectIntegration',
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn],
    async ({ args }) => {
      for (const row of castArray((args as { data: LinkRow | LinkRow[] }).data)) {
        await validateCreateRow(row);
      }
    },
  );

  registerDbHook(
    'projectIntegrationOwner:upsert',
    'ProjectIntegration',
    HookTiming.before,
    [DbAction.upsert],
    async ({ args }) => {
      const a = args as { create?: LinkRow; update?: LinkRow };
      if (a.create) await validateCreateRow(a.create);
      if (
        a.update &&
        (a.update.projectId !== undefined ||
          a.update.integrationId !== undefined ||
          a.update.project !== undefined ||
          a.update.integration !== undefined)
      ) {
        throw makeError({
          status: 422,
          message:
            'ProjectIntegration projectId and integrationId cannot be modified after creation',
        });
      }
    },
  );

  registerDbHook(
    'projectIntegrationOwner:update',
    'ProjectIntegration',
    HookTiming.before,
    [DbAction.update, DbAction.updateManyAndReturn],
    async ({ args }) => {
      const data = (args as { data?: LinkRow }).data;
      if (!data) return;
      if (
        data.projectId !== undefined ||
        data.integrationId !== undefined ||
        data.project !== undefined ||
        data.integration !== undefined
      ) {
        throw makeError({
          status: 422,
          message:
            'ProjectIntegration projectId and integrationId cannot be modified after creation',
        });
      }
    },
  );
};
