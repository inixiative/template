/**
 * @atlas
 * @kind service
 * @partOf feature:integrations, feature:project
 * @uses infrastructure:prisma, primitive:authz, primitive:errors
 */
import { db, TENANT_COLUMNS } from '@template/db';
import type { Integration, ProjectIntegration } from '@template/db/generated/client/client';
import {
  IntegrationResourceStatus,
  type ProjectOwnerModel,
} from '@template/db/generated/client/enums';
import type { Permix } from '@template/permissions/client';
import { keyBy, pick, uniq } from 'lodash-es';
import { makeError } from '#/lib/errors';
import { holdsOnRecord } from '#/lib/permissions/holdsOnRecord';
import type { IntegrationCreateProjectIntegrationItem } from '#/modules/integration/schemas/integrationProjectIntegrationSchemas';

const MAX_ITEMS_PER_REQUEST = 200;

const validateProjectIntegrationItems = (
  items: readonly IntegrationCreateProjectIntegrationItem[],
): void => {
  if (items.length === 0) {
    throw makeError({ status: 422, message: 'At least one ProjectIntegration item is required' });
  }
  if (items.length > MAX_ITEMS_PER_REQUEST) {
    throw makeError({
      status: 422,
      message: `At most ${MAX_ITEMS_PER_REQUEST} ProjectIntegration items may be sent at once`,
    });
  }

  const seenProjectIds = new Set<string>();
  for (const [index, item] of items.entries()) {
    const hasProjectId = item.projectId !== undefined;
    const hasProject = item.project !== undefined;
    if (hasProjectId === hasProject) {
      throw makeError({
        status: 422,
        message: `Item ${index} must specify exactly one of projectId or project`,
      });
    }
    if (item.projectId) {
      if (seenProjectIds.has(item.projectId)) {
        throw makeError({
          status: 422,
          message: `Duplicate projectId ${item.projectId} in request`,
        });
      }
      seenProjectIds.add(item.projectId);
    }

    const resourceInputs = item.resources ?? [];
    const seenIntegrationResourceIds = new Set<string>();
    let identityCount = 0;
    for (const resourceInput of resourceInputs) {
      if (seenIntegrationResourceIds.has(resourceInput.integrationResourceId)) {
        throw makeError({
          status: 422,
          message: `Duplicate integrationResourceId ${resourceInput.integrationResourceId} in item ${index}`,
        });
      }
      seenIntegrationResourceIds.add(resourceInput.integrationResourceId);
      if (resourceInput.isIdentity) identityCount += 1;
    }
    if (identityCount > 1) {
      throw makeError({
        status: 422,
        message: `Item ${index} may mark at most one resource as isIdentity`,
      });
    }
  }
};

const fetchOrCreateProjectId = async (
  permix: Permix,
  integration: Integration,
  item: IntegrationCreateProjectIntegrationItem,
): Promise<string> => {
  if (item.projectId) {
    // Check permission before existence so unreadable/foreign UUIDs return 403 uniformly.
    const projectIntegrationCandidate = {
      id: '',
      projectId: item.projectId,
      integrationId: integration.id,
    };
    if (
      !(await holdsOnRecord(permix, 'projectIntegration', projectIntegrationCandidate, 'create'))
    ) {
      throw makeError({ status: 403, message: 'Access denied' });
    }
    const existing = await db.project.findFirst({ where: { id: item.projectId } });
    if (!existing) throw makeError({ status: 404, message: `Project ${item.projectId} not found` });
    return existing.id;
  }

  const ownerFields = {
    ownerModel: integration.ownerModel as ProjectOwnerModel,
    ...pick(integration, TENANT_COLUMNS),
  };
  const projectData = { ...item.project!, ...ownerFields };
  if (!(await holdsOnRecord(permix, 'project', { id: '', ...projectData }, 'create'))) {
    throw makeError({ status: 403, message: 'Access denied' });
  }
  const created = await db.project.create({ data: projectData });
  return created.id;
};

export const createManyIntegrationProjectIntegrations = async (
  permix: Permix,
  integrationId: string,
  items: readonly IntegrationCreateProjectIntegrationItem[],
) => {
  validateProjectIntegrationItems(items);

  return await db.txn(async () => {
    const existingProjectIds = uniq(
      items.map((item) => item.projectId).filter((id): id is string => typeof id === 'string'),
    ).sort();
    for (const existingProjectId of existingProjectIds) {
      await db.findForUpdate('Project', { id: existingProjectId });
    }

    const [integration] = await db.findForUpdate<Integration>('Integration', { id: integrationId });
    if (!integration) {
      throw makeError({ status: 404, message: `Integration ${integrationId} not found` });
    }

    const projectIntegrationIds: string[] = [];

    for (const item of items) {
      const projectId = await fetchOrCreateProjectId(permix, integration, item);
      const projectIntegrationPair = { projectId, integrationId: integration.id };

      if (
        !item.projectId &&
        !(await holdsOnRecord(
          permix,
          'projectIntegration',
          { id: '', ...projectIntegrationPair },
          'create',
        ))
      ) {
        throw makeError({ status: 403, message: 'Access denied' });
      }

      const [priorProjectIntegration] = await db.withDeleted(() =>
        db.findForUpdate<ProjectIntegration>('ProjectIntegration', projectIntegrationPair, {
          upserting: true,
        }),
      );
      const revivingDeletedLink = Boolean(priorProjectIntegration?.deletedAt);

      const projectIntegration = await db.withDeleted(() =>
        db.projectIntegration.upsert({
          where: { projectId_integrationId: projectIntegrationPair },
          create: projectIntegrationPair,
          update: { deletedAt: null },
        }),
      );
      projectIntegrationIds.push(projectIntegration.id);

      const resourceInputs = item.resources ?? [];
      if (revivingDeletedLink && resourceInputs.some((input) => input.isIdentity === true)) {
        // why: reviving a tombstoned ProjectIntegration also revives prior cascaded identity rows; clear stale identity before applying the request's identity.
        await db.projectIntegrationResource.updateManyAndReturn({
          where: { projectIntegrationId: projectIntegration.id, isIdentity: true },
          data: { isIdentity: false },
        });
      }

      // why: process non-identity updates first so swapping identity within one item never trips the partial unique index
      const orderedResourceInputs = [...resourceInputs].sort(
        (a, b) => Number(Boolean(a.isIdentity)) - Number(Boolean(b.isIdentity)),
      );

      for (const resourceInput of orderedResourceInputs) {
        const resource = await db.integrationResource.findFirst({
          where: { id: resourceInput.integrationResourceId, integrationId: integration.id },
        });
        if (!resource) {
          throw makeError({
            status: 404,
            message: `IntegrationResource ${resourceInput.integrationResourceId} not found`,
          });
        }

        const resourcePair = { projectId, integrationResourceId: resource.id };
        const candidateIsIdentity = resourceInput.isIdentity ?? false;
        if (
          !(await holdsOnRecord(
            permix,
            'projectIntegrationResource',
            {
              id: '',
              ...resourcePair,
              projectIntegrationId: projectIntegration.id,
              isIdentity: candidateIsIdentity,
            },
            'create',
          ))
        ) {
          throw makeError({ status: 403, message: 'Access denied' });
        }

        if (resourceInput.isIdentity === true) {
          const conflictingIdentity = await db.projectIntegrationResource.findFirst({
            where: {
              projectIntegrationId: projectIntegration.id,
              isIdentity: true,
              integrationResourceId: { not: resource.id },
            },
          });
          if (conflictingIdentity) {
            throw makeError({
              status: 409,
              message: 'Project already has an identity resource for this Integration',
            });
          }
        }

        await db.withDeleted(() =>
          db.projectIntegrationResource.upsert({
            where: { projectId_integrationResourceId: resourcePair },
            create: {
              ...resourcePair,
              projectIntegrationId: projectIntegration.id,
              isIdentity: candidateIsIdentity,
            },
            update: {
              deletedAt: null,
              projectIntegrationId: projectIntegration.id,
              ...(resourceInput.isIdentity !== undefined
                ? { isIdentity: resourceInput.isIdentity }
                : {}),
            },
          }),
        );
      }
    }

    const rows = await db.projectIntegration.findMany({
      where: { id: { in: projectIntegrationIds } },
      include: {
        project: true,
        projectIntegrationResources: {
          where: {
            integrationResource: { status: { not: IntegrationResourceStatus.untracked } },
          },
        },
      },
    });
    const rowsById = keyBy(rows, 'id');
    return projectIntegrationIds.map((id) => rowsById[id]!);
  });
};
