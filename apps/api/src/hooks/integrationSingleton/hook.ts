/**
 * @atlas
 * @kind hook
 * @partOf feature:integrations
 * @uses infrastructure:prisma, primitive:errors
 */
import { DbAction, db, HookTiming, type Prisma, registerDbHook } from '@template/db';
import type { Integration, ProjectIntegration } from '@template/db/generated/client/client';
import { isIntegrationSingleton } from '@template/shared/integrations/integrationSingletons';
import { castArray, pickBy } from 'lodash-es';
import { makeError } from '#/lib/errors';
import { integrationOwnerKey } from '#/modules/integration/services/integrationOwnerKey';

type IntegrationRow = Partial<Integration>;
type ConnectInput = { connect?: { id?: string } };
type LinkRow = Partial<ProjectIntegration> & { project?: ConnectInput; integration?: ConnectInput };
type WriteArgs<T, W> = { data?: T | T[]; create?: T; where?: W };
type IntegrationWrite = WriteArgs<IntegrationRow, Prisma.IntegrationWhereInput>;
type LinkWrite = WriteArgs<LinkRow, Prisma.ProjectIntegrationWhereInput>;

const assertOwnerSingletonFree = async (row: IntegrationRow): Promise<void> => {
  if (!isIntegrationSingleton(row.provider, 'owner')) return;
  const key = integrationOwnerKey(row);
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
  const projectId = link.projectId ?? link.project?.connect?.id;
  const integrationId = link.integrationId ?? link.integration?.connect?.id;
  if (!projectId || !integrationId) return;
  const integration = await db.integration.findUnique({
    where: { id: integrationId },
    select: { provider: true },
  });
  if (!isIntegrationSingleton(integration?.provider, 'project')) return;
  await db.findForUpdate('ProjectIntegration', { projectId }, { upserting: true });
  const existing = await db.projectIntegration.findFirst({
    where: {
      projectId,
      integrationId: { not: integrationId },
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

const createdRows = <T, W>(args: WriteArgs<T, W>): T[] =>
  args.create ? [args.create] : args.data ? castArray(args.data) : [];

const isRestore = <T extends { deletedAt?: Date | null }, W>(args: WriteArgs<T, W>) =>
  !Array.isArray(args.data) && args.data?.deletedAt === null;

const assertRestoredIntegrationsFree = async (
  where: Prisma.IntegrationWhereInput | undefined,
): Promise<void> => {
  const restored = await db.withDeleted(() =>
    db.integration.findMany({ where, include: { projectIntegrations: true } }),
  );
  for (const integration of restored) {
    await assertOwnerSingletonFree(integration);
    for (const link of integration.projectIntegrations.filter((row) => !row.deletedAt))
      await assertProjectSingletonFree(link);
  }
};

const assertRestoredLinksFree = async (
  where: Prisma.ProjectIntegrationWhereInput | undefined,
): Promise<void> => {
  const restored = await db.withDeleted(() =>
    db.projectIntegration.findMany({
      where,
      select: { projectId: true, integrationId: true },
    }),
  );
  for (const link of restored) await assertProjectSingletonFree(link);
};

export const registerIntegrationSingletonHook = () => {
  registerDbHook(
    'integrationSingleton:integrationCreate',
    'Integration',
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn],
    async ({ args }) => {
      for (const row of createdRows(args as IntegrationWrite)) await assertOwnerSingletonFree(row);
    },
  );

  registerDbHook(
    'integrationSingleton:integrationUpsert',
    'Integration',
    HookTiming.before,
    [DbAction.upsert],
    async ({ args }) => {
      const write = args as IntegrationWrite;
      const target = await db.withDeleted(() => db.integration.findFirst({ where: write.where }));
      if (!target) return assertOwnerSingletonFree(write.create ?? {});
      if (target.deletedAt) await assertOwnerSingletonFree(target);
    },
  );

  registerDbHook(
    'integrationSingleton:integrationRestore',
    'Integration',
    HookTiming.before,
    [DbAction.update, DbAction.updateManyAndReturn],
    async ({ args }) => {
      const write = args as IntegrationWrite;
      if (isRestore(write)) await assertRestoredIntegrationsFree(write.where);
    },
  );

  registerDbHook(
    'integrationSingleton:linkCreate',
    'ProjectIntegration',
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn, DbAction.upsert],
    async ({ args }) => {
      for (const row of createdRows(args as LinkWrite)) await assertProjectSingletonFree(row);
    },
  );

  registerDbHook(
    'integrationSingleton:linkRestore',
    'ProjectIntegration',
    HookTiming.before,
    [DbAction.update, DbAction.updateManyAndReturn],
    async ({ args }) => {
      const write = args as LinkWrite;
      if (isRestore(write)) await assertRestoredLinksFree(write.where);
    },
  );
};
