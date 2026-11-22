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
import { check, rebacSchema } from '@template/permissions/rebac';
import type { Context } from 'hono';
import { makeError } from '#/lib/errors';
import type { SettingUpsertItem } from '#/modules/setting/schemas/settingSchemas';
import type { AppEnv } from '#/types/appEnv';

/**
 * Shared atomic batch writer for all 8 parent-scoped `PATCH /.../settings` routes:
 * 1. Rejects empty arrays (`[]`) and duplicate keys within the batch (422) before auth/locking.
 * 2. Authorizes EVERY item upfront (`db:setting:manage`) — all-or-nothing (403 writes nothing).
 * 3. Sorts keys lexicographically to avoid lock-ordering deadlocks under concurrent writes.
 * 4. Inside one `db.txn`, locks each `(resourceModel, ...targetFks, key)` via
 *    `db.findForUpdate(..., { upserting: true })`, updates live row or creates new row,
 *    and returns raw `Setting[]`.
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
      rebacSchema,
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
      const live = locked.find((row) => row.deletedAt === null);

      const payload = buildAttributeUpsertData('setting', item.key, item.value, {
        resourceModel,
        disabled: item.disabled,
      });

      if (live) {
        saved.push(await db.setting.update({ where: { id: live.id }, data: payload }));
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
