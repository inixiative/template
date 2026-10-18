/**
 * @atlas
 * @kind hook
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { DbAction, type HookOptions, HookTiming, registerDbHook } from '@template/db';
import { artifactKindDef } from '@template/shared/artifact';
import { type HookRow, writtenPatches } from '#/hooks/shared/hookRows';
import { makeError } from '#/lib/errors';

const stampCreationAccess = (row: HookRow): void => {
  const kind = artifactKindDef(String(row.kind));
  if (!kind)
    throw makeError({ status: 422, message: `Unknown artifact kind: ${String(row.kind)}` });
  row.type = kind.type;
  if (row.access === undefined || row.access === 'inherit') row.access = kind.defaultAccess;
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
    'artifactAccess:upsert',
    'Artifact',
    HookTiming.before,
    [DbAction.upsert],
    async ({ args }: HookOptions) => {
      const { create } = (args ?? {}) as { create?: HookRow };
      if (create) stampCreationAccess(create);
    },
  );
};
