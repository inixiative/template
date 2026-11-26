/**
 * @atlas
 * @kind service
 * @partOf feature:setting
 * @uses infrastructure:prisma, primitive:authz, primitive:errors
 */
import {
  buildAttributeUpsertData,
  type HydratedRecord,
  hydrate,
  polymorphicArmKeys,
} from '@template/db';
import type { Setting } from '@template/db/generated/client/client';
import type { SettingResourceModel } from '@template/db/generated/client/enums';
import { check } from '@template/permissions/rebac';
import type { Context } from 'hono';
import { makeError } from '#/lib/errors';
import type { SettingUpsertItem } from '#/modules/setting/schemas/settingSchemas';
import type { AppEnv } from '#/types/appEnv';

/**
 * Shared atomic batch writer for all 8 parent-scoped `PATCH /.../settings` routes:
 * 1. Rejects empty arrays (`[]`) and duplicate keys within the batch (422) before auth/locking.
 * 2. Authorizes EVERY item upfront (`db:Setting:manage`) — all-or-nothing (403 writes nothing).
 * 3. Sorts keys lexicographically to avoid lock-ordering deadlocks under concurrent writes.
 * 4. Inside one `db.txn`, locks each `(resourceModel, ...targetFks, key)` via
 *    `db.findForUpdate(..., { upserting: true })`, updates the not-deleted row or creates a new row,
 *    and returns raw `Setting[]`. The attributes hook refuses a key the resource's tree doesn't hold (422).
 */
export const upsertResourceSettings = async (
  c: Context<AppEnv>,
  resourceModel: SettingResourceModel,
  items: readonly SettingUpsertItem[],
): Promise<Setting[]> => {
  if (items.length === 0) {
    throw makeError({ status: 422, message: 'At least one setting item is required' });
  }

  const seenKeys = new Set<string>();
  for (const item of items) {
    if (seenKeys.has(item.key)) {
      throw makeError({ status: 422, message: `Duplicate setting key '${item.key}' in batch` });
    }
    seenKeys.add(item.key);
  }

  const db = c.get('db');
  const permix = c.get('permix');
  const resource = c.get('resource') as Record<string, unknown>;
  const resourceId = resource.id as string;
  const targetFks = polymorphicArmKeys('Setting', 'resourceModel', resourceModel, resource);

  const hydratedBase = await hydrate('setting', {
    id: '',
    resourceModel,
    resourceId,
    ...targetFks,
  } as HydratedRecord);

  for (const item of items) {
    const allowed = check(
      permix,
      'setting',
      { ...hydratedBase, key: item.key } as HydratedRecord,
      'manage',
    );
    if (!allowed) {
      throw makeError({ status: 403, message: 'Access denied' });
    }
  }

  const sortedItems = [...items].sort((left, right) => left.key.localeCompare(right.key));

  return db.txn(async () => {
    const saved: Setting[] = [];
    for (const item of sortedItems) {
      const whereKey = {
        resourceModel,
        ...targetFks,
        key: item.key,
      };

      const locked = await db.findForUpdate<Setting>('Setting', whereKey, { upserting: true });
      const notDeleted = locked.find((row) => row.deletedAt === null);

      const resolvedDisabled = item.disabled ?? (notDeleted?.disabled ? false : undefined);
      const payload = buildAttributeUpsertData('setting', item.key, item.value, {
        disabled: resolvedDisabled,
      });

      if (notDeleted) {
        saved.push(await db.setting.update({ where: { id: notDeleted.id }, data: payload }));
      } else {
        saved.push(
          await db.setting.create({
            data: {
              resourceModel,
              resourceId,
              ...targetFks,
              key: item.key,
              disabled: item.disabled ?? false,
              ...payload,
            },
          }),
        );
      }
    }
    return saved;
  });
};
