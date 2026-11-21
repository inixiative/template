/**
 * @atlas
 * @kind service
 * @partOf feature:setting
 * @uses infrastructure:prisma
 */
import { buildAttributeUpsertData, db, type Prisma } from '@template/db';
import type { Setting } from '@template/db/generated/client/client';
import type { SettingKey } from '@template/shared/settings';
import type { ResolvedSettingTarget } from '#/modules/setting/services/fetchSettingTarget';

export type UpsertSettingParams = {
  target: ResolvedSettingTarget;
  key: SettingKey;
  value: unknown;
  disabled?: boolean;
};

/**
 * Atomically creates or updates a live Setting row for `(target, key)`, fenced via
 * `db.findForUpdate(..., { upserting: true })` so concurrent writes serialize cleanly.
 */
export const upsertSetting = async ({
  target,
  key,
  value,
  disabled,
}: UpsertSettingParams): Promise<Setting> =>
  db.txn(async () => {
    const whereKey = {
      resourceModel: target.resourceModel,
      ...target.targetFks,
      key,
    };

    const lockedRows = await db.findForUpdate<Setting>('Setting', whereKey, { upserting: true });
    const existing = lockedRows.find((row) => row.deletedAt === null);
    const attributeData = buildAttributeUpsertData('setting', key, value, {
      resourceModel: target.resourceModel,
      disabled,
    });

    if (existing) {
      return db.setting.update({
        where: { id: existing.id },
        data: attributeData as Prisma.SettingUncheckedUpdateInput,
      });
    }

    return db.setting.create({
      data: {
        resourceModel: target.resourceModel,
        resourceId: target.resourceId,
        ...target.targetFks,
        key,
        disabled: disabled ?? false,
        ...attributeData,
      } as Prisma.SettingUncheckedCreateInput,
    });
  });
