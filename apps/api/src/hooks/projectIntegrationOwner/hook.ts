/**
 * @atlas
 * @kind hook
 * @partOf feature:project
 * @uses infrastructure:prisma, primitive:errors
 */
import { DbAction, db, HookTiming, registerDbHook } from '@template/db';
import type { ProjectIntegration } from '@template/db/generated/client/client';
import {
  type OwnerScopeBoundary,
  projectIntegrationOwnerViolation,
} from '@template/shared/integrations';
import { castArray, chunk } from 'lodash-es';
import { makeError } from '#/lib/errors';

const VALIDATION_CHUNK_SIZE = 2_000;

type OwnerBoundaryRow = OwnerScopeBoundary & { id: string };

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

const fetchBoundaryMap = async (
  model: 'project' | 'integration',
  ids: string[],
): Promise<Map<string, OwnerBoundaryRow>> => {
  const byId = new Map<string, OwnerBoundaryRow>();
  for (const batch of chunk(ids, VALIDATION_CHUNK_SIZE)) {
    const rows =
      model === 'project'
        ? await db.project.findMany({
            where: { id: { in: batch }, deletedAt: null },
            select: { id: true, organizationId: true, spaceId: true, userId: true },
          })
        : await db.integration.findMany({
            where: { id: { in: batch }, deletedAt: null },
            select: { id: true, organizationId: true, spaceId: true, userId: true },
          });
    for (const row of rows) byId.set(row.id, row);
  }
  return byId;
};

const validateProjectIntegrationPair = (
  projectId: string,
  integrationId: string,
  projectsById: Map<string, OwnerBoundaryRow>,
  integrationsById: Map<string, OwnerBoundaryRow>,
): void => {
  const project = projectsById.get(projectId);
  if (!project) {
    throw makeError({ status: 422, message: `Project ${projectId} not found` });
  }
  const integration = integrationsById.get(integrationId);
  if (!integration) {
    throw makeError({ status: 422, message: `Integration ${integrationId} not found` });
  }

  const violation = projectIntegrationOwnerViolation(project, integration);
  if (violation) {
    throw makeError({ status: 422, message: violation });
  }
};

const validateCreateRows = async (rows: LinkRow[]): Promise<void> => {
  const pending: { projectId: string; integrationId: string }[] = [];
  for (const row of rows) {
    const projectId = extractRelationId(row.projectId, row.project, 'projectId');
    const integrationId = extractRelationId(row.integrationId, row.integration, 'integrationId');
    if (projectId && integrationId) pending.push({ projectId, integrationId });
  }
  if (!pending.length) return;

  const uniqueProjectIds = [...new Set(pending.map((row) => row.projectId))];
  const uniqueIntegrationIds = [...new Set(pending.map((row) => row.integrationId))];

  const [projectsById, integrationsById] = await Promise.all([
    fetchBoundaryMap('project', uniqueProjectIds),
    fetchBoundaryMap('integration', uniqueIntegrationIds),
  ]);

  for (const { projectId, integrationId } of pending) {
    validateProjectIntegrationPair(projectId, integrationId, projectsById, integrationsById);
  }
};

export const registerProjectIntegrationOwnerHook = () => {
  registerDbHook(
    'projectIntegrationOwner:create',
    'ProjectIntegration',
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn],
    async ({ args }) => {
      await validateCreateRows(castArray((args as { data: LinkRow | LinkRow[] }).data));
    },
  );

  registerDbHook(
    'projectIntegrationOwner:upsert',
    'ProjectIntegration',
    HookTiming.before,
    [DbAction.upsert],
    async ({ args }) => {
      const a = args as { create?: LinkRow; update?: LinkRow };
      if (a.create) await validateCreateRows([a.create]);
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
