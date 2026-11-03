/**
 * @atlas
 * @kind validator
 * @partOf primitive:authz
 * @uses infrastructure:prisma, mutex
 */
import { check } from '@inixiative/json-rules';
import {
  db,
  type EntitlementTarget,
  includeTargetEntitlements,
  withEntitlementEntries,
} from '@template/db';
import type { Entitlement } from '@template/db/generated/client/client';
import { delegateHoldsSomething } from '#/hooks/rules/delegatePermissionRules';
import { makeError } from '#/lib/errors';
import { withOwnerLock } from '#/lib/locks/withOwnerLock';

type Holder = { deletedAt: Date | null; targetEntitlements: Entitlement[] };

/** A live delegate that is not full keeps a role or a live entitlement, read under its lock. */
export const assertDelegateHoldsSomething = (target: EntitlementTarget): Promise<void> =>
  withOwnerLock({ ownerModel: target.model, ownerId: target.id }, 'entitlements', async () => {
    const holder = (await db.withDeleted(() =>
      db.delegate(target.model).findUnique({
        where: { id: target.id },
        include: includeTargetEntitlements,
      }),
    )) as Holder | null;
    if (!holder || holder.deletedAt != null) return;
    const result = check(delegateHoldsSomething, withEntitlementEntries(holder));
    if (result !== true)
      throw makeError({
        status: 422,
        message: typeof result === 'string' ? result : 'a delegate holds something',
      });
  });
