/**
 * @atlas
 * @kind hook
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { DbAction, type HookOptions, HookTiming, registerDbHook } from '@template/db';
import { artifactKindDef } from '@template/shared/artifact';
import { type HookRow, rowsBeingWritten } from '#/hooks/shared/hookRows';
import { makeError } from '#/lib/errors';

const stampKindType = (row: HookRow): void => {
  const kind = artifactKindDef(String(row.kind));
  if (!kind)
    throw makeError({ status: 422, message: `Unknown artifact kind: ${String(row.kind)}` });
  row.type = kind.type;
};

export const registerArtifactAccessHook = () => {
  registerDbHook(
    'artifactAccess',
    'Artifact',
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn, DbAction.upsert],
    async (options: HookOptions) => {
      if (options.action === DbAction.upsert) {
        const { create } = (options.args ?? {}) as { create?: HookRow };
        if (create) stampKindType(create);
        return;
      }
      for (const row of rowsBeingWritten(options)) stampKindType(row);
    },
  );
};
