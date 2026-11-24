/**
 * @atlas
 * @kind hook
 * @partOf feature:integrations
 * @uses infrastructure:prisma, primitive:errors
 */
import { DbAction, db, HookTiming, registerDbHook } from '@template/db';
import type { Integration, ProjectIntegration } from '@template/db/generated/client/client';
import { isIntegrationSingleton } from '@template/shared/integrations/integrationSingletons';
import { castArray, pickBy } from 'lodash-es';
import { makeError } from '#/lib/errors';

type IntegrationRow = Partial<Integration>;
type LinkRow = Partial<ProjectIntegration>;

const ownerKey = (row: IntegrationRow) => ({
  provider: row.provider,
  ownerModel: row.ownerModel,
  organizationId: row.organizationId ?? null,
  spaceId: row.spaceId ?? null,
  userId: row.userId ?? null,
});

const assertOwnerSingletonFree = async (row: IntegrationRow): Promise<void> => {
  if (!isIntegrationSingleton(row.provider, 'owner')) return;
  const key = ownerKey(row);
  if (db.isInTxn())
    await db.findForUpdate(
      'Integration',
      pickBy(key, (value) => value !== null),
      { upserting: true },
    );
  const existing = await db.integration.findFirst({
    where: { ...key, deletedAt: null, ...(row.id ? { id: { not: row.id } } : {}) },
    select: { id: true },
  });
  if (existing)
    throw makeError({
      status: 409,
      message: `This owner already has a ${row.provider} integration (${existing.id}); only one is allowed`,
    });
};

const assertProjectSingletonFree = async (link: LinkRow): Promise<void> => {
  if (!link.projectId || !link.integrationId) return;
  const integration = await db.integration.findUnique({
    where: { id: link.integrationId },
    select: { provider: true },
  });
  if (!isIntegrationSingleton(integration?.provider, 'project')) return;
  if (db.isInTxn())
    await db.findForUpdate(
      'ProjectIntegration',
      { projectId: link.projectId },
      { upserting: true },
    );
  const existing = await db.projectIntegration.findFirst({
    where: {
      projectId: link.projectId,
      integrationId: { not: link.integrationId },
      deletedAt: null,
      integration: { provider: integration?.provider, deletedAt: null },
    },
    select: { integrationId: true },
  });
  if (existing)
    throw makeError({
      status: 409,
      message: `This project is already linked to a ${integration?.provider} integration (${existing.integrationId}); only one is allowed`,
    });
};

const revivedLinks = async (where: unknown): Promise<LinkRow[]> =>
  db.withDeleted(() =>
    db.projectIntegration.findMany({
      where: where as never,
      select: { projectId: true, integrationId: true },
    }),
  );

export const registerIntegrationSingletonHook = () => {
  registerDbHook(
    'integrationSingleton:integrationCreate',
    'Integration',
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn],
    async ({ args }) => {
      for (const row of castArray((args as { data: IntegrationRow | IntegrationRow[] }).data))
        await assertOwnerSingletonFree(row);
    },
  );

  registerDbHook(
    'integrationSingleton:integrationUpsert',
    'Integration',
    HookTiming.before,
    [DbAction.upsert],
    async ({ args }) => {
      const create = (args as { create?: IntegrationRow }).create;
      if (create) await assertOwnerSingletonFree(create);
    },
  );

  registerDbHook(
    'integrationSingleton:linkCreate',
    'ProjectIntegration',
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn],
    async ({ args }) => {
      for (const row of castArray((args as { data: LinkRow | LinkRow[] }).data))
        await assertProjectSingletonFree(row);
    },
  );

  registerDbHook(
    'integrationSingleton:linkUpsert',
    'ProjectIntegration',
    HookTiming.before,
    [DbAction.upsert],
    async ({ args }) => {
      const create = (args as { create?: LinkRow }).create;
      if (create) await assertProjectSingletonFree(create);
    },
  );

  registerDbHook(
    'integrationSingleton:linkRevive',
    'ProjectIntegration',
    HookTiming.before,
    [DbAction.update, DbAction.updateManyAndReturn],
    async ({ args }) => {
      const a = args as { where?: unknown; data?: LinkRow };
      if (a.data?.deletedAt !== null) return;
      for (const link of await revivedLinks(a.where)) await assertProjectSingletonFree(link);
    },
  );
};
