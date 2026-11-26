/**
 * @atlas
 * @kind hook
 * @partOf feature:project
 * @uses infrastructure:prisma, primitive:errors
 */
import {
  DbAction,
  db,
  type HookOptions,
  HookTiming,
  registerDbHook,
  type SingleAction,
} from '@template/db';
import type { ProjectIntegrationResource } from '@template/db/generated/client/client';
import { castArray, chunk } from 'lodash-es';
import { makeError } from '#/lib/errors';

const VALIDATION_CHUNK_SIZE = 2_000;

type RelationConnectInput = {
  connect?: { id?: string };
  create?: unknown;
  connectOrCreate?: unknown;
};

type ResourceLinkRow = Partial<ProjectIntegrationResource> & {
  project?: RelationConnectInput;
  integrationResource?: RelationConnectInput;
  projectIntegration?: RelationConnectInput;
};

type ValidatableRow = {
  projectId: string;
  integrationResourceId: string;
  projectIntegrationId: string;
};

const extractRelationId = (
  directId: string | null | undefined,
  nested: RelationConnectInput | undefined,
  fieldLabel: 'projectId' | 'integrationResourceId' | 'projectIntegrationId',
): string | null | undefined => {
  if (typeof directId === 'string' && directId.length > 0) return directId;
  if (directId === null) return null;
  if (!nested) return undefined;
  if (nested.create !== undefined || nested.connectOrCreate !== undefined) {
    throw makeError({
      status: 422,
      message: `ProjectIntegrationResource requires an existing ${fieldLabel}; nested create/connectOrCreate is not allowed`,
    });
  }
  if (typeof nested.connect?.id === 'string' && nested.connect.id.length > 0) {
    return nested.connect.id;
  }
  return undefined;
};

const validateProjectIntegrationResourceRows = async (rows: ValidatableRow[]): Promise<void> => {
  if (!rows.length) return;

  const projectIntegrationIds = [...new Set(rows.map((r) => r.projectIntegrationId))];
  const integrationResourceIds = [...new Set(rows.map((r) => r.integrationResourceId))];

  const linksById = new Map<string, { projectId: string; integrationId: string }>();
  const resourcesById = new Map<string, { integrationId: string }>();

  for (const batch of chunk(projectIntegrationIds, VALIDATION_CHUNK_SIZE)) {
    const found = await db.projectIntegration.findMany({
      where: { id: { in: batch }, deletedAt: null },
      select: { id: true, projectId: true, integrationId: true },
    });
    for (const row of found) linksById.set(row.id, row);
  }

  for (const batch of chunk(integrationResourceIds, VALIDATION_CHUNK_SIZE)) {
    const found = await db.integrationResource.findMany({
      where: { id: { in: batch }, deletedAt: null },
      select: { id: true, integrationId: true },
    });
    for (const row of found) resourcesById.set(row.id, row);
  }

  for (const row of rows) {
    const link = linksById.get(row.projectIntegrationId);
    if (!link) {
      throw makeError({
        status: 422,
        message: `ProjectIntegration ${row.projectIntegrationId} not found`,
      });
    }
    if (link.projectId !== row.projectId) {
      throw makeError({
        status: 422,
        message: 'ProjectIntegrationResource projectId must match its ProjectIntegration',
      });
    }
    const resource = resourcesById.get(row.integrationResourceId);
    if (!resource) {
      throw makeError({
        status: 422,
        message: `IntegrationResource ${row.integrationResourceId} not found`,
      });
    }
    if (link.integrationId !== resource.integrationId) {
      throw makeError({
        status: 422,
        message:
          'ProjectIntegrationResource integrationResource must belong to its ProjectIntegration',
      });
    }
  }
};

const toValidatable = (
  row: ResourceLinkRow,
  previous?: Partial<ProjectIntegrationResource>,
): ValidatableRow | null => {
  const projectIntegrationId = extractRelationId(
    row.projectIntegrationId,
    row.projectIntegration,
    'projectIntegrationId',
  );
  const resolvedLinkId =
    projectIntegrationId === undefined
      ? (previous?.projectIntegrationId ?? null)
      : projectIntegrationId;
  if (!resolvedLinkId) return null;

  const projectId =
    extractRelationId(row.projectId, row.project, 'projectId') ?? previous?.projectId;
  const integrationResourceId =
    extractRelationId(
      row.integrationResourceId,
      row.integrationResource,
      'integrationResourceId',
    ) ?? previous?.integrationResourceId;

  if (!projectId || !integrationResourceId) return null;
  return { projectId, integrationResourceId, projectIntegrationId: resolvedLinkId };
};

export const registerProjectIntegrationResourceHook = () => {
  registerDbHook(
    'projectIntegrationResource:create',
    'ProjectIntegrationResource',
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn],
    async ({ args }) => {
      const pending = castArray((args as { data: ResourceLinkRow | ResourceLinkRow[] }).data)
        .map((row) => toValidatable(row))
        .filter((row): row is ValidatableRow => row !== null);
      await validateProjectIntegrationResourceRows(pending);
    },
  );

  registerDbHook(
    'projectIntegrationResource:upsert',
    'ProjectIntegrationResource',
    HookTiming.before,
    [DbAction.upsert],
    async (options) => {
      const { args, previous } = options as HookOptions & { action: SingleAction };
      const a = args as { create?: ResourceLinkRow; update?: ResourceLinkRow };
      const pending: ValidatableRow[] = [];
      if (a.create) {
        const created = toValidatable(a.create);
        if (created) pending.push(created);
      }
      if (a.update && previous) {
        const updated = toValidatable(a.update, previous as Partial<ProjectIntegrationResource>);
        if (updated) pending.push(updated);
      }
      await validateProjectIntegrationResourceRows(pending);
    },
  );

  registerDbHook(
    'projectIntegrationResource:update',
    'ProjectIntegrationResource',
    HookTiming.before,
    [DbAction.update],
    async (options) => {
      const { args, previous } = options as HookOptions & { action: SingleAction };
      const data = (args as { data?: ResourceLinkRow }).data;
      if (!data || data.deletedAt != null) return;
      const updated = toValidatable(data, previous as Partial<ProjectIntegrationResource>);
      if (updated) await validateProjectIntegrationResourceRows([updated]);
    },
  );

  registerDbHook(
    'projectIntegrationResource:updateManyAndReturn',
    'ProjectIntegrationResource',
    HookTiming.after,
    [DbAction.updateManyAndReturn],
    async ({ result }) => {
      const pending = castArray(result as ProjectIntegrationResource[])
        .filter(
          (row): row is ProjectIntegrationResource & { projectIntegrationId: string } =>
            row.deletedAt == null && typeof row.projectIntegrationId === 'string',
        )
        .map(({ projectId, integrationResourceId, projectIntegrationId }) => ({
          projectId,
          integrationResourceId,
          projectIntegrationId,
        }));
      await validateProjectIntegrationResourceRows(pending);
    },
  );
};
