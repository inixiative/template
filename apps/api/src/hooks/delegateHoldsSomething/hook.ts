/**
 * @atlas
 * @kind hook
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import { DbAction, HookTiming, registerDbHook } from '@template/db';
import type { EntitlementTargetModel } from '@template/db/generated/client/enums';
import { castArray, keyBy } from 'lodash-es';
import { assertDelegateHoldsSomething } from '#/lib/permissions/assertDelegateHoldsSomething';

type Row = { id: string; full?: boolean; role?: unknown; deletedAt?: Date | null };

const DELEGATE_MODELS: readonly EntitlementTargetModel[] = ['Token', 'Integration'];

// A create is checked by the writer that lays its entitlements down right after it (createToken,
// createIntegration); an update that takes the role or `full` off a live delegate is checked here.
export const registerDelegateHoldsSomethingHook = () => {
  registerDbHook(
    'delegateHoldsSomething',
    DELEGATE_MODELS,
    HookTiming.after,
    [DbAction.update, DbAction.updateManyAndReturn, DbAction.upsert],
    async ({ model, result, previous }) => {
      const before = keyBy(castArray(previous ?? []) as Row[], 'id');
      const holdsBy = (row: Row | undefined) => row?.full === true || row?.role != null;
      const roleless = (castArray(result ?? []) as Row[]).filter((row) => {
        const prior = before[row.id];
        return prior?.deletedAt == null && holdsBy(prior) && !holdsBy(row) && row.deletedAt == null;
      });
      for (const row of roleless)
        await assertDelegateHoldsSomething({
          model: model as EntitlementTargetModel,
          id: row.id,
        });
    },
  );
};
