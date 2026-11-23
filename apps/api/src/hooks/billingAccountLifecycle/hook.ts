/**
 * @atlas
 * @kind hook
 * @partOf feature:billing
 * @uses infrastructure:prisma, primitive:appEvents, primitive:jobs
 */
import { DbAction, db, HookTiming, registerDbHook } from '@template/db';
import type { BillingAccount, Setting } from '@template/db/generated/client/client';
import {
  BillingAccountOwnerModel,
  BillingAccountSharing,
  BillingAccountStatus,
  SettingResourceModel,
} from '@template/db/generated/client/enums';
import { castArray } from 'lodash-es';
import { emitAppEvent } from '#/appEvents/emit';
import { rowsBeingWritten } from '#/hooks/shared/hookRows';
import { isSoftDeleteTransition } from '#/hooks/shared/softDeleteTransition';
import { enqueueJob } from '#/jobs/enqueue';
import {
  type BillingOwnerRef,
  computeEffectiveIsShared,
} from '#/modules/billingAccount/services/billingGovernance';

const GOVERNANCE_SETTING_KEYS = new Set([
  'billing.allowSpaceBilling',
  'billing.allowOrgUserBilling',
  'billing.allowSpaceUserBilling',
]);

const SHARE_SETTING_KEY = 'billing.shareAccountsWithMembers';

const applyIsSharedToCreateRow = async (row: Record<string, unknown>) => {
  const ownerModel = row.ownerModel as BillingAccountOwnerModel | undefined;
  if (!ownerModel) return;
  const sharing =
    (row.sharing as BillingAccountSharing | undefined) ?? BillingAccountSharing.inherit;
  const owner: BillingOwnerRef = {
    ownerModel,
    userId: (row.userId as string | null | undefined) ?? null,
    organizationId: (row.organizationId as string | null | undefined) ?? null,
    spaceId: (row.spaceId as string | null | undefined) ?? null,
  };
  row.isShared = await computeEffectiveIsShared(sharing, owner);
};

const syncInheritedSharingForSetting = async (setting: Setting) => {
  const isEffective =
    !setting.disabled && setting.deletedAt === null && setting.valueBoolean === true;
  if (
    setting.resourceModel === SettingResourceModel.Organization &&
    setting.resourceOrganizationId
  ) {
    await db.billingAccount.updateManyAndReturn({
      where: {
        ownerModel: BillingAccountOwnerModel.Organization,
        organizationId: setting.resourceOrganizationId,
        sharing: BillingAccountSharing.inherit,
        deletedAt: null,
      },
      data: { isShared: isEffective },
    });
  } else if (
    setting.resourceModel === SettingResourceModel.Space &&
    setting.resourceOrganizationId &&
    setting.resourceSpaceId
  ) {
    await db.billingAccount.updateManyAndReturn({
      where: {
        ownerModel: BillingAccountOwnerModel.Space,
        organizationId: setting.resourceOrganizationId,
        spaceId: setting.resourceSpaceId,
        sharing: BillingAccountSharing.inherit,
        deletedAt: null,
      },
      data: { isShared: isEffective },
    });
  }
};

export const registerBillingAccountLifecycleHook = () => {
  registerDbHook(
    'billingAccountSharingBeforeCreate',
    'BillingAccount',
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn, DbAction.upsert],
    async ({ action, args }) => {
      if (action === DbAction.upsert) {
        const createRow = (args as { create?: Record<string, unknown> }).create;
        if (createRow) await applyIsSharedToCreateRow(createRow);
        return;
      }
      const data = (args as { data?: Record<string, unknown> | Record<string, unknown>[] }).data;
      if (!data) return;
      for (const row of castArray<Record<string, unknown>>(data)) {
        await applyIsSharedToCreateRow(row);
      }
    },
  );

  registerDbHook(
    'billingAccountBeforeUpdate',
    'BillingAccount',
    HookTiming.before,
    [DbAction.update, DbAction.updateManyAndReturn, DbAction.upsert],
    async ({ action, args }) => {
      const typedArgs = args as {
        data?: Record<string, unknown>;
        update?: Record<string, unknown>;
        where?: Record<string, unknown>;
      };
      const patch = action === DbAction.upsert ? typedArgs.update : typedArgs.data;
      if (!patch) return;

      if (patch.deletedAt !== undefined && patch.deletedAt !== null) {
        patch.status = BillingAccountStatus.canceled;
        patch.isDefault = false;
      }

      if (patch.sharing === undefined) return;
      const sharing = patch.sharing as BillingAccountSharing;
      if (sharing === BillingAccountSharing.off) {
        patch.isShared = false;
        return;
      }

      if (action === DbAction.updateManyAndReturn) {
        if (sharing === BillingAccountSharing.on) {
          const rows = await db.billingAccount.findMany({
            where: (typedArgs.where ?? {}) as never,
            select: { ownerModel: true },
          });
          const allTenant =
            rows.length > 0 &&
            rows.every(
              (r) =>
                r.ownerModel === BillingAccountOwnerModel.Organization ||
                r.ownerModel === BillingAccountOwnerModel.Space,
            );
          patch.isShared = allTenant;
        }
        return;
      }

      if (!typedArgs.where) return;
      const existing = await db.billingAccount.findFirst({
        where: typedArgs.where as never,
        select: { ownerModel: true, userId: true, organizationId: true, spaceId: true },
      });
      if (!existing) return;
      patch.isShared = await computeEffectiveIsShared(sharing, existing);
    },
  );

  registerDbHook(
    'billingAccountSoftDeleteAfter',
    'BillingAccount',
    HookTiming.after,
    [DbAction.update, DbAction.updateManyAndReturn],
    async ({ action, args, result, previous }) => {
      const written = rowsBeingWritten({ action, args } as Parameters<typeof rowsBeingWritten>[0]);
      if (!written.some((w) => w.deletedAt != null)) return;

      const rows = (result ? castArray(result) : []) as BillingAccount[];
      const previousById = new Map<string, BillingAccount>();
      if (previous) {
        for (const prev of castArray(previous) as BillingAccount[]) {
          if (prev?.id) previousById.set(prev.id, prev);
        }
      }

      const newlyDeleted = rows.filter((row) =>
        isSoftDeleteTransition(
          previousById.get(row.id) as Record<string, unknown> | undefined,
          row as unknown as Record<string, unknown>,
        ),
      );
      if (newlyDeleted.length === 0) return;

      const dispatch = async () => {
        for (const account of newlyDeleted) {
          const prevStatus = previousById.get(account.id)?.status ?? null;
          if (account.externalCustomerId) {
            await enqueueJob('cancelBillingAccount', {
              billingAccountId: account.id,
              provider: account.provider,
              externalCustomerId: account.externalCustomerId,
              externalSubscriptionId: account.externalSubscriptionId,
            });
          }
          if (prevStatus !== BillingAccountStatus.canceled) {
            await emitAppEvent('billingAccount.statusChanged', {
              billingAccountId: account.id,
              ownerModel: account.ownerModel,
              userId: account.userId,
              organizationId: account.organizationId,
              spaceId: account.spaceId,
              previousStatus: prevStatus,
              status: BillingAccountStatus.canceled,
            });
          }
        }
      };

      if (db.isInTxn()) {
        db.onCommit(dispatch);
      } else {
        await dispatch();
      }
    },
  );

  registerDbHook(
    'billingSettingAfterWrite',
    'Setting',
    HookTiming.after,
    [
      DbAction.create,
      DbAction.createManyAndReturn,
      DbAction.update,
      DbAction.upsert,
      DbAction.updateManyAndReturn,
    ],
    async ({ result }) => {
      const settings = (result ? castArray(result) : []) as Setting[];
      for (const setting of settings) {
        if (!setting?.key) continue;
        if (setting.key === SHARE_SETTING_KEY) {
          await syncInheritedSharingForSetting(setting);
        } else if (GOVERNANCE_SETTING_KEYS.has(setting.key) && setting.resourceOrganizationId) {
          const isEnabled =
            !setting.disabled && setting.deletedAt === null && setting.valueBoolean === true;
          if (!isEnabled) {
            const payload = {
              organizationId: setting.resourceOrganizationId,
              spaceId: setting.resourceSpaceId,
              userId: setting.resourceUserId,
            };
            const schedule = async () => {
              await enqueueJob('reconcileBillingGovernance', payload);
            };
            if (db.isInTxn()) {
              db.onCommit(schedule);
            } else {
              await schedule();
            }
          }
        }
      }
    },
  );
};
