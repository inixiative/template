/**
 * @atlas
 * @kind service
 * @partOf feature:integrations, feature:project
 * @uses infrastructure:prisma, primitive:authz, primitive:errors
 */
import { db } from '@template/db';
import type { Integration } from '@template/db/generated/client/client';
import type { ProjectOwnerModel } from '@template/db/generated/client/enums';
import type { Permix } from '@template/permissions/client';
import { pick } from 'lodash-es';
import { makeError } from '#/lib/errors';
import { holdsOnRecord } from '#/lib/permissions/holdsOnRecord';
import type { IntegrationCreateProjectIntegrationItem } from '#/modules/integration/schemas/integrationProjectIntegrationSchemas';

const MAX_ITEMS_PER_REQUEST = 200;

const validateItems = (items: readonly IntegrationCreateProjectIntegrationItem[]): void => {
  if (items.length === 0) {
    throw makeError({ status: 422, message: 'At least one project integration item is required' });
  }
  if (items.length > MAX_ITEMS_PER_REQUEST) {
    throw makeError({
      status: 422,
      message: `At most ${MAX_ITEMS_PER_REQUEST} project integration items may be sent at once`,
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

    const resources = item.resources ?? [];
    const seenResourceIds = new Set<string>();
    let identityCount = 0;
    for (const resource of resources) {
      if (seenResourceIds.has(resource.integrationResourceId)) {
        throw makeError({
          status: 422,
          message: `Duplicate integrationResourceId ${resource.integrationResourceId} in item ${index}`,
        });
      }
      seenResourceIds.add(resource.integrationResourceId);
      if (resource.isIdentity) identityCount += 1;
    }
    if (identityCount > 1) {
      throw makeError({
        status: 422,
        message: `Item ${index} may mark at most one resource as isIdentity`,
      });
    }
  }
};

const resolveProjectId = async (
  permix: Permix,
  integration: Integration,
  item: IntegrationCreateProjectIntegrationItem,
): Promise<string> => {
  if (item.projectId) {
    const existing = await db.project.findFirst({ where: { id: item.projectId } });
    if (!existing) throw makeError({ status: 404, message: `Project ${item.projectId} not found` });
    return existing.id;
  }

  const ownerFields = {
    ownerModel: integration.ownerModel as ProjectOwnerModel,
    ...pick(integration, ['userId', 'organizationId', 'spaceId']),
  };
  if (!(await holdsOnRecord(permix, 'project', { id: '', ...ownerFields }, 'create'))) {
    throw makeError({ status: 403, message: 'Access denied' });
  }
  const created = await db.project.create({
    data: { ...ownerFields, ...item.project! },
  });
  return created.id;
};

export const createManyIntegrationProjectIntegrations = async (
  permix: Permix,
  integrationId: string,
  items: readonly IntegrationCreateProjectIntegrationItem[],
) => {
  validateItems(items);

  return await db.txn(async () => {
    await db.findForUpdate('Integration', { id: integrationId });
    const integration = await db.integration.findUniqueOrThrow({ where: { id: integrationId } });

    const createdLinkIds: string[] = [];

    for (const item of items) {
      const projectId = await resolveProjectId(permix, integration, item);
      const linkPair = { projectId, integrationId: integration.id };

      if (!(await holdsOnRecord(permix, 'projectIntegration', { id: '', ...linkPair }, 'create'))) {
        throw makeError({ status: 403, message: 'Access denied' });
      }

      const projectIntegration = await db.withDeleted(() =>
        db.projectIntegration.upsert({
          where: { projectId_integrationId: linkPair },
          create: linkPair,
          update: { deletedAt: null },
        }),
      );
      createdLinkIds.push(projectIntegration.id);

      // why: process non-identity updates first so swapping identity within one item never trips the partial unique index
      const orderedResources = [...(item.resources ?? [])].sort(
        (a, b) => Number(Boolean(a.isIdentity)) - Number(Boolean(b.isIdentity)),
      );

      for (const resourceInput of orderedResources) {
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
        if (
          !(await holdsOnRecord(
            permix,
            'projectIntegrationResource',
            { id: '', ...resourcePair },
            'create',
          ))
        ) {
          throw makeError({ status: 403, message: 'Access denied' });
        }

        const isIdentity = resourceInput.isIdentity ?? false;
        if (isIdentity) {
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
              message: 'Project already has an identity resource for this integration',
            });
          }
        }

        await db.withDeleted(() =>
          db.projectIntegrationResource.upsert({
            where: { projectId_integrationResourceId: resourcePair },
            create: {
              ...resourcePair,
              projectIntegrationId: projectIntegration.id,
              isIdentity,
            },
            update: {
              deletedAt: null,
              projectIntegrationId: projectIntegration.id,
              isIdentity,
            },
          }),
        );
      }
    }

    const rows = await db.projectIntegration.findMany({
      where: { id: { in: createdLinkIds } },
      include: {
        project: true,
        projectIntegrationResources: { where: { deletedAt: null } },
      },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return createdLinkIds.map((id) => byId.get(id)!);
  });
};
