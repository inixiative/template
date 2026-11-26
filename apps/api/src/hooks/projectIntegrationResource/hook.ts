/**
 * @atlas
 * @kind hook
 * @partOf feature:integrations, feature:project
 * @uses infrastructure:prisma, primitive:errors
 */
import { DbAction, db, HookTiming, registerDbHook } from '@template/db';
import type { ProjectIntegrationResource } from '@template/db/generated/client/client';
import { chunk, keyBy, uniq } from 'lodash-es';
import { changedPairs } from '#/hooks/shared/hookRows';
import { makeError } from '#/lib/errors';

const VALIDATION_CHUNK_SIZE = 2_000;

type ProjectIntegrationResourceCheckRow = {
  projectId: string;
  integrationResourceId: string;
  projectIntegrationId: string;
  revivedFromStampMs: number | null;
};

type ParentRow<T> = T & { id: string; deletedAt: Date | null };

const isParentAliveOrSiblingRevive = (
  deletedAt: Date | null,
  revivedFromStampMs: number | null,
): boolean =>
  deletedAt === null || (revivedFromStampMs !== null && deletedAt.getTime() === revivedFromStampMs);

const fetchProjectIntegrationsById = async (ids: string[]) => {
  const rows: ParentRow<{ projectId: string; integrationId: string }>[] = [];
  for (const batch of chunk(ids, VALIDATION_CHUNK_SIZE)) {
    rows.push(
      ...(await db.withDeleted(() =>
        db.projectIntegration.findMany({
          where: { id: { in: batch } },
          select: { id: true, projectId: true, integrationId: true, deletedAt: true },
        }),
      )),
    );
  }
  return keyBy(rows, 'id');
};

const fetchIntegrationResourcesById = async (ids: string[]) => {
  const rows: ParentRow<{ integrationId: string }>[] = [];
  for (const batch of chunk(ids, VALIDATION_CHUNK_SIZE)) {
    rows.push(
      ...(await db.withDeleted(() =>
        db.integrationResource.findMany({
          where: { id: { in: batch } },
          select: { id: true, integrationId: true, deletedAt: true },
        }),
      )),
    );
  }
  return keyBy(rows, 'id');
};

const validateProjectIntegrationResources = async (
  rows: ProjectIntegrationResourceCheckRow[],
): Promise<void> => {
  if (rows.length === 0) return;

  const projectIntegrationIds = uniq(rows.map((row) => row.projectIntegrationId));
  const integrationResourceIds = uniq(rows.map((row) => row.integrationResourceId));
  const [projectIntegrationsById, integrationResourcesById] = await Promise.all([
    fetchProjectIntegrationsById(projectIntegrationIds),
    fetchIntegrationResourcesById(integrationResourceIds),
  ]);

  for (const row of rows) {
    const projectIntegration = projectIntegrationsById[row.projectIntegrationId];
    if (
      !projectIntegration ||
      !isParentAliveOrSiblingRevive(projectIntegration.deletedAt, row.revivedFromStampMs)
    ) {
      throw makeError({
        status: 422,
        message: `ProjectIntegration ${row.projectIntegrationId} not found`,
      });
    }
    if (projectIntegration.projectId !== row.projectId) {
      throw makeError({
        status: 422,
        message: 'ProjectIntegrationResource projectId must match its ProjectIntegration',
      });
    }
    const integrationResource = integrationResourcesById[row.integrationResourceId];
    if (
      !integrationResource ||
      !isParentAliveOrSiblingRevive(integrationResource.deletedAt, row.revivedFromStampMs)
    ) {
      throw makeError({
        status: 422,
        message: `IntegrationResource ${row.integrationResourceId} not found`,
      });
    }
    if (integrationResource.integrationId !== projectIntegration.integrationId) {
      throw makeError({
        status: 422,
        message:
          'ProjectIntegrationResource integrationResource must belong to the same Integration as its ProjectIntegration',
      });
    }
  }
};

export const registerProjectIntegrationResourceHook = () => {
  registerDbHook(
    'projectIntegrationResource:consistency',
    'ProjectIntegrationResource',
    HookTiming.after,
    [
      DbAction.create,
      DbAction.createManyAndReturn,
      DbAction.update,
      DbAction.updateManyAndReturn,
      DbAction.upsert,
    ],
    async (options) => {
      const toValidate: ProjectIntegrationResourceCheckRow[] = [];

      for (const pair of changedPairs(options)) {
        const written = pair.result as ProjectIntegrationResource | undefined;
        const previous = pair.previous as ProjectIntegrationResource | undefined;
        if (!written) continue;

        if (
          previous &&
          (previous.projectId !== written.projectId ||
            previous.integrationResourceId !== written.integrationResourceId)
        ) {
          throw makeError({
            status: 422,
            message:
              'ProjectIntegrationResource projectId and integrationResourceId cannot be modified after creation',
          });
        }

        if (written.deletedAt !== null) continue;

        if (written.isIdentity && !written.projectIntegrationId) {
          throw makeError({
            status: 422,
            message: 'ProjectIntegrationResource with isIdentity requires a ProjectIntegration',
          });
        }

        if (written.projectIntegrationId) {
          toValidate.push({
            projectId: written.projectId,
            integrationResourceId: written.integrationResourceId,
            projectIntegrationId: written.projectIntegrationId,
            revivedFromStampMs:
              previous?.deletedAt instanceof Date ? previous.deletedAt.getTime() : null,
          });
        }
      }

      await validateProjectIntegrationResources(toValidate);
    },
  );
};
