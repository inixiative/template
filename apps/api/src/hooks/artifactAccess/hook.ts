/**
 * @atlas
 * @kind hook
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { DbAction, db, type HookOptions, HookTiming, registerDbHook } from '@template/db';
import { artifactKindDef } from '@template/shared/artifact';
import { castArray, uniq } from 'lodash-es';
import { type HookRow, writtenPatches } from '#/hooks/shared/hookRows';
import { makeError } from '#/lib/errors';

type ArtifactRow = { id: string; access: string };

const stampCreationAccess = (row: HookRow): void => {
  const kind = artifactKindDef(String(row.kind));
  if (!kind)
    throw makeError({ status: 422, message: `Unknown artifact kind: ${String(row.kind)}` });
  if (row.access === undefined || row.access === 'inherit') row.access = kind.defaultAccess;
};

const hasContainer = async (artifactId: string): Promise<boolean> =>
  (await db.artifactContainer.count({ where: { artifactId } })) > 0;

const settleOrphanedInherit = async (artifactIds: string[]): Promise<void> => {
  const orphans = await db.artifact.findMany({
    where: { id: { in: uniq(artifactIds) }, access: 'inherit', containers: { none: {} } },
    select: { id: true },
  });
  for (const { id } of orphans) {
    await db.artifact.update({ where: { id }, data: { access: 'private' } });
  }
};

export const registerArtifactAccessHook = () => {
  registerDbHook(
    'artifactAccess:create',
    'Artifact',
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn],
    async (options: HookOptions) => {
      for (const row of writtenPatches(options)) stampCreationAccess(row);
    },
  );

  registerDbHook(
    'artifactAccess:update',
    'Artifact',
    HookTiming.before,
    [DbAction.update, DbAction.upsert],
    async ({ action, args }: HookOptions) => {
      const { where, data, create, update } = (args ?? {}) as {
        where?: { id?: string };
        data?: HookRow;
        create?: HookRow;
        update?: HookRow;
      };
      if (action === DbAction.upsert && create) stampCreationAccess(create);
      const patch = action === DbAction.upsert ? update : data;
      if (patch?.access !== 'inherit' || !where?.id) return;
      if (!(await hasContainer(where.id))) patch.access = 'private';
    },
  );

  registerDbHook(
    'artifactAccess:updateMany',
    'Artifact',
    HookTiming.after,
    [DbAction.updateManyAndReturn],
    async ({ result }: HookOptions) => {
      const rows = castArray(result ?? []) as ArtifactRow[];
      await settleOrphanedInherit(
        rows.filter((row) => row.access === 'inherit').map((row) => row.id),
      );
    },
  );

  registerDbHook(
    'artifactAccess:lastContainer',
    'ArtifactContainer',
    HookTiming.after,
    [DbAction.delete, DbAction.deleteMany],
    async ({ result }: HookOptions) => {
      const edges = castArray(result ?? []) as { artifactId: string }[];
      await settleOrphanedInherit(edges.map((edge) => edge.artifactId));
    },
  );
};
