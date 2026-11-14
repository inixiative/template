/**
 * @atlas
 * @kind hook
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import { DbAction, HookTiming, registerDbHook } from '@template/db';
import type { EntitlementResourceModel } from '@template/db/generated/client/enums';
import { castArray } from 'lodash-es';
import { validateEntitlementLens } from '#/lib/permissions/validateEntitlementLens';

type EntitlementRow = { resource: EntitlementResourceModel; lens?: unknown };

export const registerEntitlementLensHook = () => {
  registerDbHook(
    'entitlementLens',
    'Entitlement',
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn],
    async ({ args }) => {
      for (const row of castArray((args as { data: EntitlementRow | EntitlementRow[] }).data))
        validateEntitlementLens(row);
    },
  );

  registerDbHook(
    'entitlementLens:upsert',
    'Entitlement',
    HookTiming.before,
    [DbAction.upsert],
    async ({ args }) => validateEntitlementLens((args as { create: EntitlementRow }).create),
  );
};
